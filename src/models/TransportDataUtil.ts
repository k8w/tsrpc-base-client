import { TSBuffer } from "tsbuffer";
import { ApiReturn, ServerInputData, ServerOutputData, TransportDataProto, TsrpcError } from 'tsrpc-proto';
import { BaseClient } from "..";
import { ApiService, MsgService, ServiceMap } from "./ServiceMapUtil";

export type ParsedServerInput = { type: 'api', service: ApiService, req: any, sn?: number } | { type: 'msg', service: MsgService, msg: any };
export type ParsedServerOutput = { type: 'api', service: ApiService, sn?: number, ret: ApiReturn<any> } | { type: 'msg', service: MsgService, msg: any };

export class TransportDataUtil {

    private static _tsbuffer?: TSBuffer;
    static get tsbuffer(): TSBuffer {
        if (!this._tsbuffer) {
            this._tsbuffer = new TSBuffer(TransportDataProto)
        }

        return this._tsbuffer;
    }

    static encodeClientMsg(tsbuffer: TSBuffer, service: MsgService, msg: any, type: 'buffer', connType: BaseClient<any>['type']): EncodeOutput<Uint8Array>;
    static encodeClientMsg(tsbuffer: TSBuffer, service: MsgService, msg: any, type: 'text', connType: BaseClient<any>['type']): EncodeOutput<string>;
    static encodeClientMsg(tsbuffer: TSBuffer, service: MsgService, msg: any, type: 'text' | 'buffer', connType: BaseClient<any>['type']): EncodeOutput<Uint8Array> | EncodeOutput<string>;
    static encodeClientMsg(tsbuffer: TSBuffer, service: MsgService, msg: any, type: 'text' | 'buffer', connType: BaseClient<any>['type']): EncodeOutput<Uint8Array> | EncodeOutput<string> {
        if (type === 'buffer') {
            let op = tsbuffer.encode(msg, service.msgSchemaId);
            if (!op.isSucc) {
                return op;
            }
            let serverInputData: ServerOutputData = {
                serviceId: service.id,
                buffer: op.buf
            }
            let opOut = this.tsbuffer.encode(serverInputData, 'ServerInputData');
            return opOut.isSucc ? { isSucc: true, output: opOut.buf } : { isSucc: false, errMsg: opOut.errMsg };
        }
        else {
            let op = tsbuffer.encodeJSON(msg, service.msgSchemaId);
            if (!op.isSucc) {
                return op;
            }
            return { isSucc: true, output: JSON.stringify(connType === 'SHORT' ? op.json : [service.name, op.json]) };
        }
    }

    static encodeApiReq(tsbuffer: TSBuffer, service: ApiService, req: any, type: 'buffer', sn?: number): EncodeOutput<Uint8Array>;
    static encodeApiReq(tsbuffer: TSBuffer, service: ApiService, req: any, type: 'text', sn?: number): EncodeOutput<string>;
    static encodeApiReq(tsbuffer: TSBuffer, service: ApiService, req: any, type: 'text' | 'buffer', sn?: number): EncodeOutput<Uint8Array> | EncodeOutput<string>;
    static encodeApiReq(tsbuffer: TSBuffer, service: ApiService, req: any, type: 'text' | 'buffer', sn?: number): EncodeOutput<Uint8Array> | EncodeOutput<string> {
        if (type === 'buffer') {
            let op = tsbuffer.encode(req, service.reqSchemaId);
            if (!op.isSucc) {
                return op;
            }
            let serverInputData: ServerInputData = {
                serviceId: service.id,
                buffer: op.buf,
                sn: sn
            }
            let opOut = this.tsbuffer.encode(serverInputData, 'ServerInputData');
            return opOut.isSucc ? { isSucc: true, output: opOut.buf } : { isSucc: false, errMsg: opOut.errMsg };
        }
        else {
            let op = tsbuffer.encodeJSON(req, service.reqSchemaId);
            if (!op.isSucc) {
                return op;
            }
            return { isSucc: true, output: JSON.stringify(sn === undefined ? op.json : [service.name, op.json, sn]) };
        }
    }

    static encodeServerMsg(tsbuffer: TSBuffer, service: MsgService, msg: any, type: 'buffer', connType: BaseClient<any>['type']): EncodeOutput<Uint8Array>;
    static encodeServerMsg(tsbuffer: TSBuffer, service: MsgService, msg: any, type: 'text', connType: BaseClient<any>['type']): EncodeOutput<string>;
    static encodeServerMsg(tsbuffer: TSBuffer, service: MsgService, msg: any, type: 'text' | 'buffer', connType: BaseClient<any>['type']): EncodeOutput<Uint8Array> | EncodeOutput<string>;
    static encodeServerMsg(tsbuffer: TSBuffer, service: MsgService, msg: any, type: 'text' | 'buffer', connType: BaseClient<any>['type']): EncodeOutput<Uint8Array> | EncodeOutput<string> {
        if (type === 'buffer') {
            let op = tsbuffer.encode(msg, service.msgSchemaId);
            if (!op.isSucc) {
                return op;
            }
            let serverOutputData: ServerOutputData = {
                serviceId: service.id,
                buffer: op.buf
            }
            let opOut = this.tsbuffer.encode(serverOutputData, 'ServerOutputData');
            return opOut.isSucc ? { isSucc: true, output: opOut.buf } : { isSucc: false, errMsg: opOut.errMsg };
        }
        else {
            let op = tsbuffer.encodeJSON(msg, service.msgSchemaId);
            if (!op.isSucc) {
                return op;
            }
            return { isSucc: true, output: JSON.stringify(connType === 'SHORT' ? op.json : [service.name, op.json]) }
        }
    }

    static parseServerOutout(tsbuffer: TSBuffer, serviceMap: ServiceMap, data: Uint8Array | string, serviceId?: number): { isSucc: true, result: ParsedServerOutput } | { isSucc: false, errMsg: string } {
        if (typeof data === 'string') {
            let json: any;
            try {
                json = JSON.parse(data);
            }
            catch (e: any) {
                return { isSucc: false, errMsg: `Invalid input JSON: ${e.message}` };
            }
            let body: any;
            let sn: number | undefined;

            let service: ApiService | MsgService | undefined;

            if (serviceId == undefined) {
                if (!Array.isArray(json)) {
                    return { isSucc: false, errMsg: `Invalid server output format` };
                }
                let serviceName = json[0];
                service = serviceMap.apiName2Service[serviceName] ?? serviceMap.msgName2Service[serviceName];
                if (!service) {
                    return { isSucc: false, errMsg: `Invalid service name: ${serviceName} (from ServerOutputData)` };
                }
                body = json[1];
                sn = json[2];
            }
            else {
                service = serviceMap.id2Service[serviceId];
                if (!service) {
                    return { isSucc: false, errMsg: `Invalid service ID: ${serviceId}` };
                }
                body = json;
            }

            if (service.type === 'api') {
                if (body.isSucc && 'res' in body) {
                    let op = tsbuffer.decodeJSON(body.res, service.resSchemaId);
                    if (!op.isSucc) {
                        return op;
                    }
                    body.res = op.value;
                }
                else if (body.err) {
                    body.err = new TsrpcError(body.err)
                }
                else {
                    return { isSucc: false, errMsg: `Invalid server output format` };
                }
                return {
                    isSucc: true,
                    result: {
                        type: 'api',
                        service: service,
                        sn: sn,
                        ret: body
                    }
                };
            }
            else {
                let op = tsbuffer.decodeJSON(body, service.msgSchemaId);
                if (!op.isSucc) {
                    return op;
                }
                return {
                    isSucc: true,
                    result: {
                        type: 'msg',
                        service: service,
                        msg: op.value
                    }
                }
            }
        }
        else {
            let opServerOutputData = this.tsbuffer.decode<ServerOutputData>(data, 'ServerOutputData');
            if (!opServerOutputData.isSucc) {
                return opServerOutputData;
            }
            let serverOutputData = opServerOutputData.value;
            serviceId = serviceId ?? serverOutputData.serviceId;
            if (serviceId === undefined) {
                return { isSucc: false, errMsg: `Missing 'serviceId' in ServerOutput` };
            }

            let service = serviceMap.id2Service[serviceId];
            if (!service) {
                return { isSucc: false, errMsg: `Invalid service ID: ${serviceId} (from ServerOutput)` };
            }

            if (service.type === 'msg') {
                if (!serverOutputData.buffer) {
                    return { isSucc: false, errMsg: 'Empty msg buffer (from ServerOutput)' };
                }
                let opMsg = tsbuffer.decode(serverOutputData.buffer, service.msgSchemaId);
                if (!opMsg.isSucc) {
                    return opMsg;
                }

                return {
                    isSucc: true,
                    result: {
                        type: 'msg',
                        service: service,
                        msg: opMsg.value
                    }
                }
            }
            else {
                if (serverOutputData.error) {
                    return {
                        isSucc: true,
                        result: {
                            type: 'api',
                            service: service,
                            sn: serverOutputData.sn,
                            ret: {
                                isSucc: false,
                                err: new TsrpcError(serverOutputData.error)
                            }
                        }
                    }
                }
                else {
                    if (!serverOutputData.buffer) {
                        return { isSucc: false, errMsg: 'Empty API res buffer (from ServerOutput)' };
                    }

                    let opRes = tsbuffer.decode(serverOutputData.buffer, service.resSchemaId);
                    if (!opRes.isSucc) {
                        return opRes;
                    }

                    return {
                        isSucc: true,
                        result: {
                            type: 'api',
                            service: service,
                            sn: serverOutputData.sn,
                            ret: {
                                isSucc: true,
                                res: opRes.value,
                            }
                        }
                    }
                }
            }
        }

    }

}

export declare type EncodeOutput<T> = {
    isSucc: true;
    /** Encoded binary buffer */
    output: T;
    errMsg?: undefined;
} | {
    isSucc: false;
    /** Error message */
    errMsg: string;
    output?: undefined;
};