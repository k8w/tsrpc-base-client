# CHANGELOG

## [1.0.8] - 2021-08-14

### Changed
- `listenMsg` 的监听函数类型改为 `(msg, msgName, client)=>void` 
## [1.0.7] - 2021-07-21

### Changed
- `callApi` 返回错误非业务错误时，通过 `logger.error` 打印日志而不是 `logger.log`。