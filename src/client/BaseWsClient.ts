import { BaseServiceType, ServiceProto, TsrpcError } from "tsrpc-proto";
import { TransportOptions } from "../models/TransportOptions";
import { BaseClient, BaseClientOptions, defaultBaseClientOptions, PendingApiItem } from "./BaseClient";

/**
 * WebSocket Client for TSRPC.
 * It uses native `WebSocket` of browser.
 * @typeParam ServiceType - `ServiceType` from generated `proto.ts`
 */
export class BaseWsClient<ServiceType extends BaseServiceType = any> extends BaseClient<ServiceType> {

    readonly type = 'LONG';

    protected _wsc: IWebSocketProxy;

    readonly options!: Readonly<BaseWsClientOptions>;
    constructor(proto: ServiceProto<ServiceType>, wsc: IWebSocketProxy, options?: Partial<BaseWsClientOptions>) {
        super(proto, {
            ...defaultBaseWsClientOptions,
            ...options
        });

        this._wsc = wsc;
        wsc.onOpen = this._onWsOpen;
        wsc.onClose = this._onWsClose;
        wsc.onError = this._onWsError;
        wsc.onMessage = this._onWsMessage;

        this.logger?.log('TSRPC WebSocket Client :', this.options.server);
    }

    protected _onWsOpen = () => {
        if (!this._connecting) {
            return;
        }

        this._isConnected = true;
        this._connecting.rs({ isSucc: true });
        this._connecting = undefined;
        this.logger?.log('WebSocket connection to server successful');

        this.flows.postConnectFlow.exec({}, this.logger);
    };

    protected _onWsClose = (code: number, reason: string) => {
        let isConnectedBefore = this._isConnected;
        this._isConnected = false;

        // 连接中，返回连接失败
        if (this._connecting) {
            this._connecting.rs({
                isSucc: false,
                errMsg: 'WebSocket connection to server failed'
            });
            this._connecting = undefined;
        }

        // disconnect中，返回成功
        let isManual = !!this._rsDisconnecting;
        if (this._rsDisconnecting) {
            this._rsDisconnecting();
            this._rsDisconnecting = undefined;
            this.logger?.log('Disconnected succ', `code=${code} reason=${reason}`);
        }
        // 非 disconnect 中，从连接中意外断开
        else if (isConnectedBefore) {
            this.logger?.log(`Lost connection to ${this.options.server}`, `code=${code} reason=${reason}`);
        }

        // postDisconnectFlow，仅从连接状态断开时触发
        if (isConnectedBefore) {
            this.flows.postDisconnectFlow.exec({
                reason: reason,
                isManual: isManual
            }, this.logger);
        }
    };

    protected _onWsError = (e: Error) => {
        this.logger?.error('[WebSocket Error]', e);
    };

    protected _onWsMessage = (data: Uint8Array | string) => {
        if (typeof data === 'string') {
            this.logger?.log('[RecvText]', data)
        }
        else {
            this._onRecvBuf(data);
        }
    };

    protected async _sendBuf(buf: Uint8Array, options: TransportOptions, serviceId: number, pendingApiItem?: PendingApiItem): Promise<{ err?: TsrpcError; }> {
        return new Promise<{ err?: TsrpcError | undefined; }>(async rs => {
            // Pre Flow
            let pre = await this.flows.preSendBufferFlow.exec({ buf: buf, sn: pendingApiItem?.sn }, this.logger);
            if (!pre) {
                return;
            }
            buf = pre.buf;

            if (!this.isConnected) {
                rs({
                    err: new TsrpcError('WebSocket is not connected', {
                        code: 'WS_NOT_OPEN',
                        type: TsrpcError.Type.ClientError
                    })
                });
                return;
            }

            // Do Send
            let buffer = Buffer.from(buf);
            this.options.debugBuf && this.logger?.debug('[SendBuf]' + (pendingApiItem ? (' #' + pendingApiItem.sn) : ''), `length=${buffer.byteLength}`, buffer);
            return this._wsc.send(buffer);
        });
    }

    private _isConnected: boolean = false;
    public get isConnected(): boolean {
        return this._isConnected;
    }

    private _connecting?: {
        promise: Promise<{ isSucc: true } | { isSucc: false, errMsg: string }>,
        rs: (v: { isSucc: true } | { isSucc: false, errMsg: string }) => void
    };
    /**
     * Start connecting, you must connect first before `callApi()` and `sendMsg()`.
     * @throws never
     */
    async connect(): Promise<{ isSucc: true } | { isSucc: false, errMsg: string }> {
        // 已连接成功
        if (this.isConnected) {
            return { isSucc: true };
        }

        // 已连接中
        if (this._connecting) {
            return this._connecting.promise;
        }

        // Pre Flow
        let pre = await this.flows.preConnectFlow.exec({}, this.logger);
        // Pre return
        if (pre?.return) {
            return pre.return;
        }
        // Canceled
        if (!pre) {
            return new Promise(rs => { });
        }

        this._wsc.connect(this.options.server);
        this.logger?.log(`Start connecting ${this.options.server}...`);
        let promiseConnect = new Promise<{ isSucc: true } | { isSucc: false, errMsg: string }>(rs => {
            this._connecting = {
                promise: promiseConnect,
                rs: rs
            }
        })

        return promiseConnect;
    }

    private _rsDisconnecting?: () => void;
    /**
     * Disconnect immediately
     * @throws never
     */
    async disconnect() {
        this.logger?.log('Start disconnecting...');
        return new Promise<void>(rs => {
            this._rsDisconnecting = rs;
            this._wsc.close();
        })
    }
}

export const defaultBaseWsClientOptions: BaseWsClientOptions = {
    ...defaultBaseClientOptions,
    server: 'ws://localhost:3000'
}

export interface BaseWsClientOptions extends BaseClientOptions {
    /** Server URL, starts with `ws://` or `wss://`. */
    server: string;
}

export interface IWebSocketProxy {
    // Events
    onOpen: () => void;
    onClose: (code: number, reason: string) => void;
    onError: (e: Error) => void;
    onMessage: (data: Uint8Array | string) => void;

    // Create and connect (return ws client)
    connect(server: string): void;
    close(): void;
    send(data: Uint8Array | string): Promise<{ err?: TsrpcError }>;
}