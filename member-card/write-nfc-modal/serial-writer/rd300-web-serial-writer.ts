type Rd300Status = (message: string) => void;

type Rd300TagType = 'ntag215' | 'desfire-ev3';
type Rd300UidSource = 'static-uid' | 'unknown';

interface SerialPortLike {
	readable: ReadableStream<Uint8Array> | null;
	writable: WritableStream<Uint8Array> | null;
	open(options: { baudRate: number; dataBits?: number; stopBits?: number; parity?: 'none' | 'even' | 'odd'; flowControl?: 'none' | 'hardware' }): Promise<void>;
	close(): Promise<void>;
}

interface SerialNavigatorLike extends Navigator {
	serial?: {
		requestPort(): Promise<SerialPortLike>;
	};
}

interface Rd300Response {
	command: number;
	status: number;
	data: number[];
}

export interface Rd300WriteResult {
	cardCode: string;
	tagType: Rd300TagType;
	uidSource: Rd300UidSource;
	raw: {
		readerInfo?: string;
		uid: string;
		ndefLength: number;
	};
}

export interface Rd300DetectedTag {
	uid: string;
	tagType: Rd300TagType;
	uidSource: Rd300UidSource;
}

export class Rd300WebSerialWriter {
	private readonly stx = 0x02;
	private readonly successStatus = 0x00;
	private readonly textEncoder = new TextEncoder();
	private port?: SerialPortLike;
	private reader?: ReadableStreamDefaultReader<Uint8Array>;
	private writer?: WritableStreamDefaultWriter<Uint8Array>;
	private pendingRead?: Promise<ReadableStreamReadResult<Uint8Array>>;
	private readBuffer: number[] = [];

	constructor(private onStatus?: Rd300Status) {}

	async connect(): Promise<void> {
		await this.ensureConnected();
	}

	async writeMemberCard(contactId: number): Promise<Rd300WriteResult> {
		await this.ensureConnected();
		this.readBuffer = [];
		const readerInfo = await this.getReaderInfo().catch(() => '');

		this.report('Place an NFC card on the RD300 reader.');
		const tag = await this.waitForStableCard();
		return this.writeMemberCardToDetectedTag(contactId, tag, readerInfo);
	}

	async waitForStableCard(options?: { blockedUid?: string; timeoutMs?: number; stableReads?: number }): Promise<Rd300DetectedTag> {
		await this.ensureConnected();
		const timeoutMs = Math.max(options?.timeoutMs ?? 30000, 1000);
		const stableReads = Math.max(options?.stableReads ?? 2, 1);
		const blockedUid = this.normalizeUid(options?.blockedUid || '');
		const startedAt = Date.now();
		let lastTag: Rd300DetectedTag | null = null;
		let matchedReads = 0;
		let sawBlockedCard = false;

		while (Date.now() - startedAt < timeoutMs) {
			const tag = await this.tryDetectTagOnce();
			if (!tag) {
				lastTag = null;
				matchedReads = 0;
				await this.delay(250);
				continue;
			}

			if (blockedUid && this.normalizeUid(tag.uid) === blockedUid) {
				sawBlockedCard = true;
				this.report(`Card ${tag.uid} is blocked for this request. Remove it and place another card.`);
				lastTag = null;
				matchedReads = 0;
				await this.delay(250);
				continue;
			}

			if (lastTag && lastTag.uid === tag.uid && lastTag.tagType === tag.tagType) {
				matchedReads++;
			} else {
				lastTag = tag;
				matchedReads = 1;
			}

			if (matchedReads >= stableReads) {
				this.report(`Detected ${tag.tagType === 'desfire-ev3' ? 'MIFARE DESFire EV3 / Type 4' : 'NTAG / Type 2'} card ${tag.uid}.`);
				return tag;
			}

			await this.delay(150);
		}

		if (sawBlockedCard && blockedUid) {
			throw new Error(`Card ${blockedUid} is still on the RD300 reader. Remove it and place another card.`);
		}

		throw new Error('No supported NFC card was detected. Supported cards: NTAG215 and preformatted MIFARE DESFire EV3 Type 4 tags.');
	}

	async waitForCardRemoval(cardUid: string, timeoutMs = 30000): Promise<void> {
		await this.ensureConnected();
		const blockedUid = this.normalizeUid(cardUid);
		const startedAt = Date.now();

		this.report(`Remove card ${cardUid} from the RD300 reader.`);
		while (Date.now() - startedAt < timeoutMs) {
			const tag = await this.tryDetectTagOnce();
			if (!tag || this.normalizeUid(tag.uid) !== blockedUid) {
				this.report('Card removed. Place the next card on the RD300 reader.');
				return;
			}

			await this.delay(250);
		}

		throw new Error(`Card ${cardUid} is still on the RD300 reader. Remove it before continuing.`);
	}

	async writeMemberCardToDetectedTag(contactId: number, tag: Rd300DetectedTag, readerInfo = ''): Promise<Rd300WriteResult> {
		await this.ensureConnected();
		const payload = JSON.stringify({ IDBP: contactId });
		const ndefMessage = this.buildNdefTextRecord(payload);

		if (tag.tagType === 'desfire-ev3') {
			await this.writeDesfireType4Ndef(ndefMessage);
		} else {
			await this.writeNtagType2Ndef(ndefMessage);
		}

		return {
			cardCode: tag.uid,
			tagType: tag.tagType,
			uidSource: tag.uidSource,
			raw: {
				readerInfo,
				uid: tag.uid,
				ndefLength: ndefMessage.length,
			},
		};
	}

	async disconnect(): Promise<void> {
		try {
			await this.reader?.cancel().catch(() => undefined);
			this.reader?.releaseLock();
		} catch {
			/* ignore close errors */
		}

		try {
			this.writer?.releaseLock();
		} catch {
			/* ignore close errors */
		}

		this.reader = undefined;
		this.writer = undefined;
		this.pendingRead = undefined;
		this.readBuffer = [];

		if (this.port) {
			await this.port.close().catch(() => undefined);
			this.port = undefined;
		}
	}

	private async ensureConnected(): Promise<void> {
		if (this.port && this.reader && this.writer) return;

		const serial = (navigator as SerialNavigatorLike).serial;
		if (!serial?.requestPort) {
			throw new Error('Web Serial is not supported by this browser. Use Chrome or Edge on HTTPS/localhost.');
		}

		this.report('Select the RD300 serial port.');
		this.port = await serial.requestPort();
		await this.port.open({
			baudRate: 9600,
			dataBits: 8,
			stopBits: 1,
			parity: 'none',
			flowControl: 'none',
		});

		if (!this.port.readable || !this.port.writable) {
			throw new Error('Cannot open the RD300 serial streams.');
		}

		this.reader = this.port.readable.getReader();
		this.writer = this.port.writable.getWriter();
		this.report('RD300 serial port is connected.');
	}

	private async getReaderInfo(): Promise<string> {
		this.report('Checking RD300 reader information.');
		const response = await this.sendCommand(0x0e);
		return this.asciiFromBytes(response.data);
	}

	private async tryDetectTagOnce(): Promise<Rd300DetectedTag | null> {
		const ntag = await this.tryReadNtagUid();
		if (ntag) return ntag;

		return await this.trySelectDesfire();
	}

	private async trySelectDesfire(): Promise<Rd300DetectedTag | null> {
		try {
			await this.sendCommand(0x30);
			const response = await this.sendCommand(0x31);
			if (response.data.length < 7) return null;

			return {
				uid: this.toHex(response.data.slice(0, 7)),
				tagType: 'desfire-ev3',
				uidSource: 'static-uid',
			};
		} catch {
			return null;
		}
	}

	private async tryReadNtagUid(): Promise<Rd300DetectedTag | null> {
		try {
			const block0 = await this.readNtagBlock(0);
			if (block0.length < 8) return null;

			return {
				uid: this.toHex([block0[0], block0[1], block0[2], block0[4], block0[5], block0[6], block0[7]]),
				tagType: 'ntag215',
				uidSource: 'static-uid',
			};
		} catch {
			return null;
		}
	}

	private async writeNtagType2Ndef(ndefMessage: number[]): Promise<void> {
		const lastAttempt = 2;
		for (let attempt = 1; attempt <= lastAttempt; attempt++) {
			try {
				await this.writeNtagType2NdefOnce(ndefMessage);
				return;
			} catch (error) {
				if (attempt === lastAttempt) throw error;
				this.report('Retrying the NTAG write once more. Keep the card steady on the reader.');
				await this.delay(180);
				this.readBuffer = [];
			}
		}
	}

	private async readNtagBlock(blockNumber: number): Promise<number[]> {
		const response = await this.sendCommand(0x13, [0x00, 0x00, blockNumber & 0xff]);
		if (response.data.length < 16) {
			throw new Error('RD300 returned an invalid NTAG read response.');
		}
		return response.data.slice(0, 16);
	}

	private async writeNtagBlock(blockNumber: number, data: number[]): Promise<void> {
		if (data.length !== 16) {
			throw new Error('NTAG write requires exactly 16 bytes.');
		}
		await this.sendCommand(0x14, [0x00, 0x00, blockNumber & 0xff, ...data]);
	}

	private async writeDesfireType4Ndef(ndefMessage: number[]): Promise<void> {
		this.report('Selecting DESFire NDEF application.');
		await this.expectApduSuccess(await this.sendDesfireApdu([0x00, 0xa4, 0x04, 0x00, 0x07, 0xd2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01, 0x00]), 'Cannot select DESFire NDEF application.');
		await this.expectApduSuccess(await this.sendDesfireApdu([0x00, 0xa4, 0x00, 0x0c, 0x02, 0xe1, 0x03]), 'Cannot select DESFire Capability Container file.');

		const ccResponse = await this.expectApduSuccess(await this.sendDesfireApdu([0x00, 0xb0, 0x00, 0x00, 0x0f]), 'Cannot read DESFire Capability Container file.');
		const ndefFile = this.parseType4CapabilityContainer(ccResponse);
		const ndefPayload = [ndefMessage.length >> 8, ndefMessage.length & 0xff, ...ndefMessage];

		if (ndefPayload.length > ndefFile.maxSize) {
			throw new Error(`NDEF payload is larger than the DESFire NDEF file size (${ndefFile.maxSize} bytes).`);
		}
		if (ndefPayload.length > 0xff) {
			throw new Error('DESFire APDU chunking is not implemented for NDEF payloads larger than 255 bytes.');
		}

		this.report('Writing Type 4 NDEF data to DESFire.');
		await this.expectApduSuccess(await this.sendDesfireApdu([0x00, 0xa4, 0x00, 0x0c, 0x02, ...ndefFile.fileId]), 'Cannot select DESFire NDEF file.');
		await this.expectApduSuccess(await this.sendDesfireApdu([0x00, 0xd6, 0x00, 0x00, ndefPayload.length, ...ndefPayload]), 'Cannot update DESFire NDEF file.');

		this.report('Verifying DESFire NDEF data.');
		const verifyResponse = await this.expectApduSuccess(await this.sendDesfireApdu([0x00, 0xb0, 0x00, 0x00, ndefPayload.length]), 'Cannot read back DESFire NDEF file.');
		if (!this.bytesEqual(verifyResponse.slice(0, ndefPayload.length), ndefPayload)) {
			throw new Error('RD300 wrote the DESFire data but read-back verification failed.');
		}
	}

	private async sendDesfireApdu(apdu: number[]): Promise<number[]> {
		const response = await this.sendCommand(0x32, apdu);
		return response.data;
	}

	private async expectApduSuccess(response: number[], errorMessage: string): Promise<number[]> {
		if (response.length < 2) {
			throw new Error(errorMessage);
		}

		const sw1 = response[response.length - 2];
		const sw2 = response[response.length - 1];
		if (sw1 !== 0x90 || sw2 !== 0x00) {
			throw new Error(`${errorMessage} APDU status: ${this.toHex([sw1, sw2])}.`);
		}

		return response.slice(0, -2);
	}

	private parseType4CapabilityContainer(cc: number[]): { fileId: number[]; maxSize: number } {
		const ndefFileControl = cc.findIndex((value, index) => index >= 7 && value === 0x04 && cc[index + 1] === 0x06);
		if (ndefFileControl < 0 || cc.length < ndefFileControl + 8) {
			throw new Error('The DESFire card is not formatted with a supported NDEF file control TLV.');
		}

		return {
			fileId: [cc[ndefFileControl + 2], cc[ndefFileControl + 3]],
			maxSize: (cc[ndefFileControl + 4] << 8) | cc[ndefFileControl + 5],
		};
	}

	private buildNdefTextRecord(text: string): number[] {
		const textBytes = this.textEncoder.encode(text);
		// Keep the Text Record format but omit the language code so scanners read only the JSON payload.
		const payload = [0x00, ...Array.from(textBytes)];
		if (payload.length > 255) {
			throw new Error('NDEF text payload is too large for the short-record encoder.');
		}

		return [0xd1, 0x01, payload.length, 0x54, ...payload];
	}

	private buildType2Tlv(ndefMessage: number[]): number[] {
		if (ndefMessage.length < 0xff) {
			return [0x03, ndefMessage.length, ...ndefMessage, 0xfe];
		}

		return [0x03, 0xff, (ndefMessage.length >> 8) & 0xff, ndefMessage.length & 0xff, ...ndefMessage, 0xfe];
	}

	private async sendCommand(command: number, data: number[] = [], timeoutMs = 5000): Promise<Rd300Response> {
		if (!this.writer) {
			throw new Error('RD300 serial writer is not connected.');
		}

		const frame = new Uint8Array([this.stx, data.length + 1, command, ...data]);
		await this.writer.write(frame);
		const response = await this.readResponse(timeoutMs);
		if (response.command !== command) {
			throw new Error(`RD300 returned command ${this.toHex([response.command])} while waiting for ${this.toHex([command])}.`);
		}
		if (response.status !== this.successStatus) {
			throw new Error(this.resolveStatusMessage(response.status));
		}

		return response;
	}

	private async readResponse(timeoutMs: number): Promise<Rd300Response> {
		if (!this.reader) {
			throw new Error('RD300 serial reader is not connected.');
		}

		const startedAt = Date.now();
		while (Date.now() - startedAt < timeoutMs) {
			const parsed = this.tryParseResponse();
			if (parsed) return parsed;

			const readTimeout = Math.max(Math.min(timeoutMs - (Date.now() - startedAt), 250), 1);
			const chunk = await this.readChunkWithTimeout(readTimeout);
			if (chunk?.length) {
				this.readBuffer.push(...Array.from(chunk));
			}
		}

		throw new Error('Timed out while waiting for RD300 response.');
	}

	private tryParseResponse(): Rd300Response | null {
		while (this.readBuffer.length && this.readBuffer[0] !== this.stx) {
			this.readBuffer.shift();
		}

		if (this.readBuffer.length < 3) return null;
		const len = this.readBuffer[1];
		const frameLength = 2 + len;
		if (this.readBuffer.length < frameLength) return null;

		const frame = this.readBuffer.splice(0, frameLength);
		if (len < 2) {
			throw new Error('RD300 returned an invalid response frame.');
		}

		return {
			command: frame[2],
			status: frame[3],
			data: frame.slice(4),
		};
	}

	private async readChunkWithTimeout(timeoutMs: number): Promise<Uint8Array | null> {
		if (!this.reader) return null;
		if (!this.pendingRead) {
			this.pendingRead = this.reader.read().finally(() => {
				this.pendingRead = undefined;
			});
		}

		return await Promise.race([
			this.pendingRead.then((result) => result.value || null),
			new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
		]);
	}

	private resolveStatusMessage(status: number): string {
		if (status === 0x01) return 'No supported card was detected on the RD300 reader, or the card command failed.';
		if (status === 0x10) return 'RD300 command error.';
		return `RD300 command failed with status ${this.toHex([status])}.`;
	}

	private async writeNtagType2NdefOnce(ndefMessage: number[]): Promise<void> {
		this.report('Writing Type 2 NDEF data to NTAG.');
		const tlv = this.buildType2Tlv(ndefMessage);
		const writeBytes = this.padToBlockSize(tlv, 16);
		const startPage = 4;

		for (let offset = 0; offset < writeBytes.length; offset += 16) {
			await this.writeNtagBlock(startPage + offset / 4, writeBytes.slice(offset, offset + 16));
		}

		await this.delay(120);
		this.report('Verifying NTAG NDEF data.');
		const readBack: number[] = [];
		for (let offset = 0; offset < writeBytes.length; offset += 16) {
			readBack.push(...(await this.readNtagBlock(startPage + offset / 4)));
		}

		if (!this.bytesStartWith(readBack, tlv)) {
			throw new Error('RD300 wrote the NTAG data but read-back verification failed.');
		}
	}

	private padToBlockSize(data: number[], blockSize: number): number[] {
		const output = [...data];
		while (output.length % blockSize !== 0) {
			output.push(0x00);
		}
		return output;
	}

	private bytesStartWith(source: number[], expected: number[]): boolean {
		return this.bytesEqual(source.slice(0, expected.length), expected);
	}

	private bytesEqual(first: number[], second: number[]): boolean {
		if (first.length !== second.length) return false;
		return first.every((value, index) => value === second[index]);
	}

	private toHex(bytes: number[]): string {
		return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
	}

	private asciiFromBytes(bytes: number[]): string {
		return String.fromCharCode(...bytes).replace(/\0/g, '').trim();
	}

	private report(message: string): void {
		this.onStatus?.(message);
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private normalizeUid(uid: string): string {
		return `${uid || ''}`.trim().toUpperCase();
	}
}
