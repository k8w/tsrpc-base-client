import { BaseServiceType, Logger, ServiceProto, TsrpcError } from "tsrpc-proto";
import { TransportOptions } from "../models/TransportOptions";
import { BaseClient, BaseClientOptions, defaultBaseClientOptions, PendingApiItem } from "./BaseClient";

/**
 * WebSocket Client for TSRPC.
 * It uses native `WebSocket` of browser.
 * @typeParam ServiceType - `ServiceType` from generated `proto.ts`
 */
export class BaseWsClient<ServiceType extends BaseServiceType = any> extends BaseClient<ServiceType> {

    readonly type = 'LONG';

    protected _wsp: IWebSocketProxy;

    readonly options!: Readonly<BaseWsClientOptions>;
    constructor(proto: ServiceProto<ServiceType>, wsp: IWebSocketProxy, options?: Partial<BaseWsClientOptions>) {
        super(proto, {
            ...defaultBaseWsClientOptions,
            ...options
        });

        this._wsp = wsp;
        wsp.options = {
            onOpen: this._onWsOpen,
            onClose: this._onWsClose,
            onError: this._onWsError,
            onMessage: this._onWsMessage,
            logger: this.logger
        }


        this.logger?.log('TSRPC WebSocket Client :', this.options.server);
    }

    protected _onWsOpen = () => {
        if (!this._connecting) {
            return;
        }

        this._status = WsClientStatus.Opened;
        this._connecting.rs({ isSucc: true });
        this._connecting = undefined;
        this.logger?.log('WebSocket connection to server successful');

        this.flows.postConnectFlow.exec({}, this.logger);
    };

    protected _onWsClose = (code: number, reason: string) => {
        let isConnectedBefore = this.isConnected;
        this._status = WsClientStatus.Closed;

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
            this.logger?.warn('[RecvText]', data)
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
            if (this.options.debugBuf && buf instanceof Uint8Array) {
                this.logger?.debug('[SendBuf]' + (pendingApiItem ? (' #' + pendingApiItem.sn) : ''), `length=${buf.byteLength}`, buf);
            }
            rs(this._wsp.send(buf));
        });
    }


    private _status: WsClientStatus = WsClientStatus.Closed;
    public get status(): WsClientStatus {
        return this._status;
    }

    public get isConnected(): boolean {
        return this._status === WsClientStatus.Opened;
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

        this._status = WsClientStatus.Opening;
        this._wsp.connect(this.options.server);
        this.logger?.log(`Start connecting ${this.options.server}...`);
        this._connecting = {} as any;
        let promiseConnect = new Promise<{ isSucc: true } | { isSucc: false, errMsg: string }>(rs => {
            this._connecting!.rs = rs;
        });
        this._connecting!.promise = promiseConnect;

        return promiseConnect;
    }

    private _rsDisconnecting?: () => void;
    /**
     * Disconnect immediately
     * @throws never
     */
    async disconnect(code?: number, reason?: string) {
        if (this._status === WsClientStatus.Closed) {
            return;
        }

        this._status = WsClientStatus.Closing;
        this.logger?.log('Start disconnecting...');
        return new Promise<void>(rs => {
            this._rsDisconnecting = rs;
            this._wsp.close(code, reason);
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
    // Options
    options: {
        onOpen: () => void;
        onClose: (code: number, reason: string) => void;
        onError: (e: Error) => void;
        onMessage: (data: Uint8Array | string) => void;
        logger?: Logger;
    },

    // Create and connect (return ws client)
    connect(server: string): void;
    close(code?: number, reason?: string): void;
    send(data: Uint8Array | string): Promise<{ err?: TsrpcError }>;
}

export enum WsClientStatus {
    Opening = 'OPENING',
    Opened = 'OPENED',
    Closing = 'CLOSING',
    Closed = 'CLOSED'
}