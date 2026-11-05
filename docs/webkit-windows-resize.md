# Windows WebKit：WebGL 绘图缓冲重设后的呈现缺陷

2026-11-04 已将本机 Windows Playwright WebKit 27.2（webkit-2370）的故障缩到不含任何游戏或SDK的复现：**已显示的WebGL canvas重设内部绘图缓冲尺寸后，GPU仍正确绘制，但窗口未显示该结果。** 视口缩放触发两套SDK的缓冲重设，因而暴露同一呈现路径缺陷；不是JSON坐标或游戏规则导致，也不需要A2Game参与。此定位针对本机该构建，不能推广为Safari、iOS或Linux WPE结论；未定位到WebKit内部具体C++行或排除其与本机驱动的交互。

## 因果对照

| 操作 | 本机 WebKit | Chromium 对照 |
| --- | --- | --- |
| 仅改变WebGL缓冲宽度，窗口和CSS尺寸不变 | 失败：GPU读回红色，窗口显示canvas背景色 | 正常 |
| 仅改变CSS宽度，缓冲不变 | 正常 | 正常 |
| 仅改变视口，canvas CSS及缓冲尺寸固定 | 正常 | 正常 |
| WebGL1 / WebGL2 缓冲重设 | 均失败 | WebGL2正常 |
| Canvas2D缓冲重设 | 正常 | 未新增此项对照 |
| 缓冲重设后再次绘制、flush、保留绘图缓冲 | 未恢复 | 正常绘制 |
| 替换为新canvas/context | 恢复 | 正常 |

有头/无头模式均复现，取消初次Playwright截图、等待初次显示1秒后再改缓冲仍复现。系统级窗口截图也显示空白，排除Playwright截图API单独出错。`readPixels=[255,0,0,255]`、`isContextLost=false`、`getError=0`与窗口背景像素`[7,15,32,255]`形成直接对照，故已定位在缓冲重设后的WebGL显示/合成路径，而非GL没有画出来。

可独立打开的[最小复现页](diagnostics/webkit-canvas-resize.html)不含外部资源。必须使用受影响的WebKit构建才能验证该故障；Cindy预览或Chrome正常不能反证WebKit问题。先等待红色画布显示，再点“重设缓冲宽度”，最后用“新建canvas/context”核对恢复。

## 早期对照与结论修正

- 同一JSON桌面初始画面正常；Three.js对照中，直接以320px启动的WebKit页面正常，Chromium同样的动态缩放正常。Air的固定窄屏启动需在后续独立页面检查中单独核实，不由Three.js结果推定。
- 手动钟、实时钟、额外绘制、viewport截图与fullPage截图均复现动态缩放空白，不能只归因截图裁切方式。
- 画布CSS/绘图缓冲尺寸有效、viewport匹配，未报告context loss或WebGL错误；Air读回仍有背景像素。
- 取消裁剪/圆角、强制合成层和paint containment未解决。早期纯WebGL最小页在初次显示前立即调整尺寸，未暴露问题；本轮显式等待初次显示后重设缓冲即可稳定复现，不能沿用早期“仅SDK集成路径有问题”的推断。

本地原始对照位于忽略的 `reports/webkit-resize-investigation-20261104/`；首单元截图与控制端报告位于该批次运行目录。材料不是公开发布的实验结果，也不作为真实品牌客户端或正式G3凭据。

## 后续验收方式

按用户“修复或明确限制后继续矩阵”的指令，后续单元的桌面、390px、320px检查使用**分别以目标视口启动的独立页面/Runtime**，保留输入、画面、释放证据。它验证固定尺寸可用性，不能声明动态缩放或设备旋转通过。该方法变更须在私有批次内记录版本、适用单元和来源；最初因缩放失败的A×G01及原始控制端脚本保持历史失败，不回签为通过，不从分母移除。

此策略没有修复或绕过SDK，也不增加浏览器安全/渲染参数、不换成Canvas2D、不改变JSON玩法或正式profile。Windows WebKit并不是Linux WPE；WPE要求及当前未执行的输入/人工/真机检查继续独立未验证。每个实际打开的MCP预览仍须原实例显式关闭，页面SDK对象释放也须单独检查。
