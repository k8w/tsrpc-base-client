import { EncodeOutput } from "tsbuffer";
import { ApiReturn, BaseServiceType, ServiceProto, TsrpcError } from "tsrpc-proto";
import { ApiService, MsgService, TransportDataUtil, TransportOptions } from "..";
import { BaseClient, BaseClientOptions, defaultBaseClientOptions, PendingApiItem } from "./BaseClient";

/**
 * Base HTTP Client
 */
export class BaseHttpClient<ServiceType extends BaseServiceType = any> extends BaseClient<ServiceType> {

    readonly type = 'SHORT';

    private _http: IHttpProxy;
    private _jsonServer: string;

    readonly options!: BaseHttpClientOptions;
    constructor(proto: ServiceProto<ServiceType>, http: IHttpProxy, options?: Partial<BaseHttpClientOptions>) {
        super(proto, {
            ...defaultBaseHttpClientOptions,
            ...options
        });
        this._http = http;
        this._jsonServer = this.options.server + (this.options.server.endsWith('/') ? '' : '/');
        this.logger?.log('TSRPC HTTP Client :', this.options.server);
    }

    // Hack for JSON compatibility
    protected _encodeApiReq(service: ApiService, req: any, pendingItem: PendingApiItem): EncodeOutput {
        if (this.options.json) {
            if (this.options.jsonPrune) {
                let opPrune = this.tsbuffer.prune(req, pendingItem.service.reqSchemaId);
                if (!opPrune.isSucc) {
                    return opPrune;
                }
                req = opPrune.pruneOutput;
            }
            return {
                isSucc: true,
                buf: JSON.stringify(req) as any
            }
        }
        else {
            return TransportDataUtil.encodeApiReq(this.tsbuffer, service, req, undefined);
        }
    }
    // Hack for JSON compatibility
    protected _encodeClientMsg(service: MsgService, msg: any): EncodeOutput {
        if (this.options.json) {
            if (this.options.jsonPrune) {
                let opPrune = this.tsbuffer.prune(msg, service.msgSchemaId);
                if (!opPrune.isSucc) {
                    return opPrune;
                }
                msg = opPrune.pruneOutput;
            }
            return {
                isSucc: true,
                buf: JSON.stringify(msg) as any
            }
        }
        else {
            return TransportDataUtil.encodeClientMsg(this.tsbuffer, service, msg);
        }
    }

    protected async _sendBuf(buf: Uint8Array, options: TransportOptions, serviceId: number, pendingApiItem?: PendingApiItem): Promise<{ err?: TsrpcError | undefined; }> {
        // JSON Compatible Mode
        if (this.options.json) {
            return this._sendJSON(buf as any as string, options, serviceId, pendingApiItem);
        }

        let sn = pendingApiItem?.sn;
        let promise = new Promise<{ err?: TsrpcError | undefined; }>(async rs => {
            // Pre Flow
            let pre = await this.flows.preSendBufferFlow.exec({ buf: buf, sn: pendingApiItem?.sn }, this.logger);
            if (!pre) {
                return;
            }
            buf = pre.buf;

            // Do Send
            this.options.debugBuf && this.logger?.debug('[SendBuf]' + (sn ? (' #' + sn) : ''), `length=${buf.length}`, buf);
            let { promise: fetchPromise, abort } = this._http.fetch({
                url: this.options.server,
                data: buf,
                method: 'POST',
                responseType: 'arraybuffer',
            });

            if (pendingApiItem) {
                pendingApiItem.onAbort = () => {
                    abort();
                }
            }

            // Aborted
            if (pendingApiItem?.isAborted) {
                return;
            }

            let fetchRes = await fetchPromise;
            if (!fetchRes.isSucc) {
                rs({ err: fetchRes.err });
                return;
            }

            rs({});
            this._onRecvBuf(fetchRes.res as Uint8Array, pendingApiItem)
        });

        promise.finally(() => {
            if (pendingApiItem) {
                pendingApiItem.onAbort = undefined;
            }
        })

        return promise;
    }

    protected async _sendJSON(jsonStr: string, options: TransportOptions, serviceId: number, pendingApiItem?: PendingApiItem): Promise<{ err?: TsrpcError | undefined; }> {
        return new Promise(async rs => {
            let { promise: fetchPromise, abort } = this._http.fetch({
                url: this._jsonServer + this.serviceMap.id2Service[serviceId].name,
                data: jsonStr,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                responseType: 'text',
            });

            if (pendingApiItem) {
                pendingApiItem.onAbort = () => {
                    abort();
                }
            }

            // Aborted
            if (pendingApiItem?.isAborted) {
                return;
            }

            let fetchRes = await fetchPromise;
            if (!fetchRes.isSucc) {
                rs({ err: fetchRes.err });
                return;
            }

            rs({});

            // Parse JSON
            let ret: ApiReturn<any>
            try {
                ret = JSON.parse(fetchRes.res as string);
            }
            catch (e) {
                ret = {
                    isSucc: false,
                    err: new TsrpcError({
                        message: e.message,
                        type: TsrpcError.Type.ServerError,
                        res: fetchRes.res
                    })
                }
            }

            // API Return
            if (pendingApiItem) {
                if (ret.isSucc) {
                    if (this.options.jsonPrune) {
                        let opPrune = this.tsbuffer.prune(ret.res, pendingApiItem.service.resSchemaId);
                        if (opPrune.isSucc) {
                            ret.res = opPrune.pruneOutput;
                        }
                        else {
                            ret = {
                                isSucc: false,
                                err: new TsrpcError('Invalid Server Output', {
                                    type: TsrpcError.Type.ClientError,
                                    innerErr: opPrune.errMsg
                                })
                            }
                        }
                    }
                }
                else {
                    ret.err = new TsrpcError(ret.err);
                }
                pendingApiItem.onReturn?.(ret);
            }
        })
    }
}

const defaultBaseHttpClientOptions: BaseHttpClientOptions = {
    ...defaultBaseClientOptions,
    server: 'http://localhost:3000',
    // logger: new TerminalColorLogger(),
    json: false,
    jsonPrune: true
}

export interface BaseHttpClientOptions extends BaseClientOptions {
    /** Server URL, starts with `http://` or `https://`. */
    server: string;

    /** 
     * Use JSON instead of binary as transfering
     * @defaultValue false
     */
    json: boolean;

    /**
     * Whether to automatically delete excess properties that not defined in the protocol.
     * @defaultValue `true`
     * @internal
     */
    jsonPrune: boolean;
}


export interface IHttpProxy {
    fetch(options: {
        url: string,
        data: string | Uint8Array,
        method: string,
        /** ms */
        timeout?: number,
        headers?: { [key: string]: string },
        responseType: 'text' | 'arraybuffer'
    }): {
        abort: () => void,
        promise: Promise<{ isSucc: true, res: string | Uint8Array } | { isSucc: false, err: TsrpcError }>
    };
}