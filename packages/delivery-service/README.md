# 本机创作与版本交付

复用 Generator Studio 的生成、预算和校验链路，通过同源 HTTP 分发经过完整准入的独立 SDK。现支持单管理员登录、固定发布权限、有界持久化生成队列、重启恢复及HTTPS代理入口。应用仍只监听loopback；未部署或执行真实TLS/外部验收，不提供多用户账户。配置和恢复边界见[运维说明](../../docs/service-operations.md)。

宿主创建配置，例如：

```json
{"releases":["output/已生成的SDK目录"],"providerId":"fixture","maxCalls":0,"allowPublish":false,"port":0}
```

执行 `node scripts/serve-delivery.mjs .a2game/delivery.json`，打开输出的地址。网页只能选择已批准版本或显式发布已完成的 Studio 任务，不能指定文件路径、程序、Provider 或预算。fixture不计真实模型生成。未配置`stateDirectory`时保持临时会话；配置后从持久记录恢复并完整复验，损坏和源码过期版本拒绝加载。

接收方先验证清单及逐文件 SHA，再在独立文档准备新播放器，确认身份和初始化完成后释放旧实例。下载、签名、摘要或初始化失败保留旧版本；成功切换后支持回退。资源在注册时读取为内存快照，按摘要去重并限制容量。

JavaScript API `startCreationDeliveryService` 可接受宿主的 `signPayload` 和 SPKI `publicKey`，使用 Ed25519 签名。生产接收方必须从可信启动配置固定公钥；同源配置接口依赖宿主及传输可信。默认无签名模式只允许本机审阅，不代表作者认证、离线缓存或互联网发布。
