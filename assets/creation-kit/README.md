# 原创创作素材包

本目录9幅透明PNG及对应SVG源、3段单声道PCM WAV和港湾模型/动画预设由本项目原创制作，按CC0-1.0提供。没有引用外部图片、模型或音频采样。

SVG是可编辑源文件；Runtime资源为宿主按SHA审核的PNG/WAV。`harbor-models.json`是现有Stage图元的模型组合与Tick旋转/粒子模板，不是任意glTF导入器或新GameSpec字段。

重新生成候选：`node scripts/build-creation-assets.mjs`。脚本生成独立output目录，不覆盖本目录或自动更新审核策略；看图、完整准入和双SDK检查后再更新来源/摘要。PNG渲染依赖当次浏览器，重新生成可能改变字节，旧摘要不能直接沿用。

运行：`node generator/cli.mjs preview games/phase2/creation-gallery --backend three --ready`；模型动画示例为`games/phase2/harbor-models`。使用`--backend air`检查另一端。浏览器音频需实际用户动作解锁；播放记录不等于独立听觉审美批准。
