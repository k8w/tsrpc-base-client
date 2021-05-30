import 'k8w-extend-native';

export class EventEmitter<EventData extends { [key: string]: any }> {

    protected _eventHandlers: {
        [eventName: string]: {
            handler: Function,
            once?: boolean,
            this?: any
        }[] | undefined
    } = {};

    protected _addHandlerItem(eventName: keyof EventData, item: {
        handler: Function,
        once?: boolean,
        this?: any
    }) {
        let handlers = this._eventHandlers[eventName as string];
        if (!handlers) {
            handlers = this._eventHandlers[eventName as string] = [];
        }

        // Handler exists already
        if (!item.once && handlers.some(v => v.handler === item.handler)) {
            return;
        }

        handlers.push(item);
    }

    on<T extends keyof EventData>(eventName: T, handler: (data: EventData[T]) => void, thisContext?: any): (data: EventData[T]) => void {
        this._addHandlerItem(eventName, {
            handler: handler,
            this: thisContext
        })
        return handler;
    }

    once<T extends keyof EventData>(eventName: T, handler: (data: EventData[T]) => void, thisContext?: any): (data: EventData[T]) => void {
        this._addHandlerItem(eventName, {
            handler: handler,
            once: true,
            this: thisContext
        })
        return handler;
    }

    off<T extends keyof EventData>(eventName: T, handler?: (data: EventData[T]) => void) {
        let handlers = this._eventHandlers[eventName as string];
        if (!handlers) {
            return;
        }

        if (!handler) {
            this._eventHandlers[eventName as string] = undefined;
            return;
        }

        handlers.remove(v => v.handler === handler);
    }

    emit<T extends keyof EventData>(eventName: T, data: EventData[T]) {
        let handlers = this._eventHandlers[eventName as string];
        if (!handlers) {
            return;
        }
        for (let i = 0; i < handlers.length; ++i) {
            let item = handlers[i];
            try {
                item.handler.call(item.this, data);
            }
            catch (e) {
                console.error(e);
            }
            if (item.once) {
                handlers.splice(i, 1);
                --i;
            }
        }
    }
}