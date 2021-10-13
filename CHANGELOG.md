# CHANGELOG

## [1.0.14] - 2021-10-13
### Changed
- `BaseHttpClient` and `BaseWsClient` no longer have default type param

## [1.0.13] - 2021-10-09
### Fixed
- Fixed missing log when encode error

## [1.0.12] - 2021-10-08
### Changed
- Rename `index.cjs` to `index.js` to fit webpack
- Update `k8w-extend-native` to 1.4.6

## [1.0.11] - 2021-09-29
### Fixed
- `WsClient` 断开连接后对所有未尽 API 请求返回错误
### Changed
- `timeout` 默认 15 秒

## [1.0.10] - 2021-09-01
### Changed
- `listenMsg` 的监听函数类型改为 `(msg, msgName)=>void` 

## [1.0.9] - 2021-08-30
### Fixed
- `logger.error` when `sendBuf` error

## [1.0.8] - 2021-08-14

### Changed
- `listenMsg` 的监听函数类型改为 `(msg, msgName, client)=>void` 
## [1.0.7] - 2021-07-21

### Changed
- `callApi` 返回错误非业务错误时，通过 `logger.error` 打印日志而不是 `logger.log`。