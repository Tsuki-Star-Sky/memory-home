# Memory Home · 记忆小屋

实验性的本地私人记忆引擎，从 qq-bridge 抽取。它帮助宿主记录有证据来源的偏好与经历，并在检索时考虑记忆衰减、认知关联、表达偏好及主动关怀边界。

这是供开发者集成的组件；当前发行版没有 QQ 客户端、聊天机器人、HTTP 服务或即开即用的管理后台。计划仓库名称为 `Tsuki-Star-Sky/memory-home`。

## 核心能力

- 保存偏好、经历与来源证据，支持编辑、遗忘、固定和归档。
- 通过认知关联和衰减模型辅助召回。
- 学习有边界的表达偏好，提供受约束的主动关怀判断。
- 提供中文 HTML 管理页面，供宿主接入。

## 本地运行

需要 **Node.js >= 22.13.0**（及随 Node 提供的 npm），**零第三方依赖**，无需安装依赖、账号、API 密钥或外部服务。

```sh
npm test
npm run demo
```

可选：在 POSIX shell 或 Git Bash 中执行 `sh setup.sh`，仅检查版本并显示后续命令；不会安装软件或修改配置。Windows PowerShell 可直接执行上述 npm 命令。

演示使用虚构身份 `private:123`，在系统临时目录创建数据库，输出一条虚构偏好并清理数据。测试也使用临时目录。如果受限 Windows 环境的临时目录禁止原子重命名，请将 TEMP 和 TMP 设置为可写的本地目录后重试。

```js
// 在本地检出目录运行：
import { PrivateMemory } from './src/private-memory/store.mjs';
const memory = new PrivateMemory({ file: './local-data/memory.json' });
// 由宿主提供可信用户身份及观察到的消息证据。
```

作为包集成时入口为 `memory-home`；此文档不表示该包已在 npm 发布。当前身份校验仍保留 QQ 场景约束：键须为 `private:` 加正的安全整数，不支持任意 UUID 或群组身份。

## 宿主接入与边界

`public/private-memory.html` 是实验性集成资源。直接打开页面不能提供可用存储。宿主须在 `/private-memory` 提供页面，实现经过身份验证的 GET/POST `/api/private-memory`，并返回页面所需的数据结构。页面从浏览器 localStorage 读取 `x-console-token`；GET 使用 `key` 查询参数，POST 使用 `{ key, action, ... }` JSON。

操作包括 forget、edit、pin、restore、archive、reviewLearning、care、settings、learning 和 clear；还需要导出处理及宿主控制台回链。实现前应检查页面完整调用约定。此发行版不提供适配器。宿主须对每个身份和操作校验权限及输入；使用 bridge 提示词时还须实现其中引用的 qq_memory 工具。

页面会从 URL 接收令牌、保存到 localStorage，并在控制台回链中传递令牌；部署前应审查该设计，避免浏览历史与请求日志泄露令牌。

记忆以**明文 JSON**保存在本地。宿主负责存储权限；引擎不提供磁盘加密、账号认证或多进程写入协调。当前测试覆盖六个核心模块，不覆盖完整宿主或浏览器集成。

## 开发与来源

贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)，开发指引见 [CLAUDE.md](CLAUDE.md)。精确抽取范围见 [FORK_REPORT.md](FORK_REPORT.md)，检查结果及警告见 [SANITIZATION_REPORT.md](SANITIZATION_REPORT.md)。

MIT 许可；保留 Derpyu520 与 qq-bridge / QSH contributors 原始署名。见 [LICENSE](LICENSE) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。该范围不包含 SnowLuma 代码、二进制文件、目录快照、安装包或补丁。
