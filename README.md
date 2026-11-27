# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Installation

```bash
npm install
```

**Note**: feel free to use the package manager of your choice.

## Local Development

```bash
npm run start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```bash
npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## 页面贡献者数据

每篇文档尾部的「本页面贡献者」由浏览器在页面加载后请求 `/contributors.json` 获得。该地址是 Netlify 的改写规则，回源到 `contributors` 分支的静态文件，浏览器不直接访问 GitHub。

### 数据怎么来

生成器、映射表和数据都住在 `contributors` 分支，`master` 上只有 Docusaurus 站点本身：

| 分支 | 内容 |
| --- | --- |
| `master` | `src/`、`docs/`、`docusaurus.config.ts`、`netlify.toml` 与 workflow |
| `contributors` | `scripts/fetch-contributors.js`、`scripts/contributors-map.json`、`contributors.json` |

每次 push 到 `master`，`.github/workflows/contributors.yml` 会拉全量历史（`--follow` 需要它才能追到改名前的提交）、从 `contributors` 分支临时取出脚本、跑一遍生成器、再把结果写回 `contributors` 分支（内容没变化就不提交）。该分支每次都是全新孤儿提交加 `--force` 覆盖，始终只有一个提交，`master` 的提交历史完全不受影响。

想手动刷新数据：

```bash
git fetch origin contributors
git checkout contributors
node scripts/fetch-contributors.js   # 依赖完整 git 历史，浅克隆会自动 fetch --unshallow
```

然后提交并推送 `contributors` 分支。结果只取决于 git 历史，重复运行是幂等的。

### 新增贡献者

贡献者的头像和主页来自 `scripts/contributors-map.json`（提交邮箱 → GitHub 账号），要改的是 `contributors` 分支上的这份文件。映射表里没有的邮箱不会让构建失败：该贡献者退化为纯文字姓名，生成器会打印提示，补齐后重跑即可。

邮箱是唯一可靠的身份标识——同一个人在不同时期可能用过不同的 git 姓名（例如 `jerry-0327` 与 `Jerry-0327`），因此映射表的键必须是小写邮箱。

头像统一取 `https://avatars.githubusercontent.com/<login>`（这个 CDN 在账号注销后仍能返回原头像，而 `github.com/<login>.png` 会直接 404）。账号注销或改名后主页链接会失效，这类条目在映射表里写 `"profileUrl": null`：头像照常显示，但不再生成跳转链接。

### 页面表现

数据在浏览器里加载，所以服务端渲染出的 HTML 不含贡献者区块，页面加载后补上。请求失败或该页没有记录时区块直接不显示，不影响正文。

## Deployment

Using SSH:

```bash
USE_SSH=true npm run deploy
```

Not using SSH:

```bash
GIT_USER=<Your GitHub username> npm run deploy
```

If you are using GitHub Pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.
