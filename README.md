# WuPage（不可说的秘密版）

**WuPage - The Unspeakable Secret Edition · V1.3**

原项目：[mr-wuliu/wupage](https://github.com/mr-wuliu/wupage)

## 关于这个版本

WuPage 是一款不可多得的良心翻译插件，功能丰富，而且支持完全离线的神经机器翻译，感谢原作者的开源贡献！

考虑到有些使用场景涉及敏感信息或内容保密，不希望翻译内容被发送到外部服务器，因此在原项目基础上制作了这个非官方修改版。

**核心思路很简单：只保留本地翻译能力，移除在线翻译服务及相关 API，让翻译尽可能简单、纯粹、可控。**

## 主要改动

1. **移除在线翻译服务**：删除 Google、DeepL、DeepSeek、OpenAI Compatible 等在线翻译及 LLM API 的调用入口和相关配置。
2. **保留离线翻译**：使用原有 Bergamot 神经机器翻译引擎，翻译内容在本机处理，不依赖在线翻译服务。
3. **保留本地 OCR**：继续支持 PaddleOCR 图片文字识别与翻译。
4. **保留模型下载**：仍可联网下载语言模型和 OCR 模型，下载完成后可离线使用。
5. **增加本地文件翻译**：支持直接翻译浏览器打开的本地 HTML、TXT 文件，并支持在线 TXT 文件。
6. **扩展右键翻译**：本地 HTML、TXT 页面也能使用右键菜单中的「全文翻译」。
7. **保留 PDF 翻译**：支持通过插件自带的 PDF 阅读器进行本地 PDF 双语翻译。

## 安装与使用

Chrome 已测试通过，Edge 理论上可以直接使用；Firefox 需要单独构建，尚未测试。

**1. 安装 Node.js**

前往 [Node.js 官网](https://nodejs.org/) 下载并安装 **Node.js 22 或更新版本**，安装时保持默认选项即可（npm 会随 Node.js 一起安装）。

安装完成后，打开 PowerShell，确认安装成功：

```powershell
node -v
npm -v
```

**2. 构建插件**

下载本项目源码并解压，在源码根目录打开 PowerShell，依次执行：

```powershell
npm ci
npm run typecheck
npm run build
```

**3. 安装插件**

构建成功后，打开 `chrome://extensions` 或 `edge://extensions`，开启「开发者模式」，点击「加载已解压的扩展程序」，选择生成的 `dist` 目录。

首次使用时，在插件设置中下载所需的离线语言模型，下载完成后即可离线翻译。

如需翻译本地 HTML、TXT 文件，请在扩展详情中开启「允许访问文件网址」。

Firefox 用户可尝试执行 `npm run build:firefox`，生成 Firefox 专用构建版本。

## 说明

- 本项目是 WuPage 的非官方 Fork。
- 不提供在线翻译服务或 LLM API，但下载本地翻译模型、打开在线网页等操作仍可能产生正常网络流量。
- 翻译功能和质量取决于原有 Bergamot 模型，本版本没有重新训练翻译模型。
- 本项目沿用原项目的 **GPL-3.0-only** 开源许可证，保留原作者及第三方组件的版权和许可声明。

再次感谢 WuPage 原作者！
