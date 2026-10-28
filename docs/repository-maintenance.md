# 仓库与本地产物维护

Git 保存 `src/`、`player/`、`test/`、`scripts/`、`specs/v0.1/`、`project/`、文档、依赖锁和源码资源。目录调整须同步引用及证据指纹。

| 本地内容 | 维护方式 |
| --- | --- |
| `reports/` | 验收原始输出、截图、Trace 和失败记录；本地保留，按现有决定不再进入 Git |
| `.a2game/` | 私有发布数据及生成器配置；保留，不入库 |
| `.tools/cocosairjs/`、`.tools/node-v22.23.4/` | 锁定 SDK 工作副本和兼容工具；保留 |
| `node_modules/`、`.venv/`、`player/vendor/` | 本地依赖及 SDK；按 README 恢复，不入库 |
| `dist/` | 可由 `npm run build` 重建；当前开发构建保留，不入库 |
| `output/`、已结束验收的 `.tools/<套件>-<时间>-<PID>/`、临时 `.tools/*.log` | 无活动任务且必要证据已归档后可清理 |

清理必须先核对 Git 跟踪状态、路径边界、符号链接及活动进程；未知目录与临时源脚本保留。不要对 `.tools/`、`.a2game/`、`reports/` 或 `.git/` 整体递归删除。

Git 重复松散对象可先用 `git prune-packed -n` 核对，再用 `git prune-packed -q` 清理已存在于 pack 的副本。这不替代证据备份；不要为节省空间删除分支或改写历史。

`reports/` 在 `713e9d9f` 已移出 Git。**全新源码检出不包含历史验收证据**，完整 `project:check`、G3/P2 档案核对及现有 CI 验收流程仍需要从可信备份恢复对应 `reports/`。目前未配置远端证据恢复渠道，不得将本地参考 PASS 当作全新检出或远端 CI 已通过。

在最新提交删除大文件不会消除父提交中的对象。推送前须检查未推送历史；GitHub 普通 Git 拒收超过 100 MiB 的文件。采用其他交付分支或提交整理方式前，应保留本地历史并明确交付范围。[GitHub 文件限制](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)

2026-10-28 用户选择更新 `main`：原本地历史保留在 `archive/local-history-20261028`（tip `97d56daf`），不推送该归档分支。源码交付提交 `b42ccf27` 与归档 tip 的文件树完全一致，父提交为原远端基线 `b910c164`；后续仅补充交付元数据。`main` 正常快进推送，既有远端历史保留，不使用 force push。
