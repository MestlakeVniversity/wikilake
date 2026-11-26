/** 从本地 git 历史生成每页贡献者数据，思路同 OI-wiki 的 commits-info。 */

const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const SITE_DIR = path.join(__dirname, '..');
const MAP_FILE = path.join(__dirname, 'contributors-map.json');
const OUTPUT_FILE = path.join(SITE_DIR, 'contributors.json');
const SOURCE_DIRS = ['docs', 'blog'].map((dir) => path.join(SITE_DIR, dir));

const RECORD_SEP = '\x1e';
const FIELD_SEP = '\x1f';
const LOG_FORMAT = '--pretty=format:%x1e%ae%x1f%an%x1f%b';
const CO_AUTHOR = /^\s*co-authored-by:\s*.+?<([^>]+)>\s*$/i;
const EXCLUDED_NAMES = [
  '24OI-Bot',
  'OI-wiki',
  'dependabot[bot]',
  'renovate[bot]',
  'github-actions[bot]',
];

/** 命中机器人命名习惯时返回 true。 */
function isBot(name) {
  const lower = name.toLowerCase();
  return (
    EXCLUDED_NAMES.some((excluded) => excluded.toLowerCase() === lower) ||
    lower.includes('[bot]') ||
    lower.endsWith('-bot') ||
    lower.startsWith('bot-')
  );
}

/** 执行 git 命令，关闭 quotepath 以免中文路径被转义。 */
function git(args) {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd: SITE_DIR,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** 浅克隆时补全历史，否则 --follow 追不到改名之前的提交。 */
function ensureFullHistory() {
  if (!fs.existsSync(path.join(SITE_DIR, '.git'))) {
    throw new Error(`未找到 .git 目录（${SITE_DIR}），本脚本需要在完整的 git 仓库中运行。`);
  }
  if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
    console.warn('⚠  当前是浅克隆，正在 fetch --unshallow...');
    git(['fetch', '--unshallow']);
  }
}

/** 映射表未显式给出 profileUrl 时按 githubUsername 推导，显式 null 表示账号已注销。 */
function profileUrlOf(entry) {
  if (entry.profileUrl !== undefined) return entry.profileUrl;
  return entry.githubUsername ? `https://github.com/${entry.githubUsername}` : null;
}

/** 读取小写邮箱到 GitHub 身份的映射表。 */
function loadMap() {
  const raw = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
  const map = new Map();
  for (const [email, entry] of Object.entries(raw)) {
    if (email.startsWith('$')) continue;
    map.set(email.toLowerCase(), {
      name: entry.name || email,
      githubUsername: entry.githubUsername || null,
      profileUrl: profileUrlOf(entry),
    });
  }
  return map;
}

/** 递归收集 markdown 文件，返回相对仓库根的 POSIX 路径并按字典序排列。 */
function collectMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
      files.push(path.relative(SITE_DIR, fullPath).split(path.sep).join('/'));
    }
  }
  return files.sort();
}

/** 解析一条 git log 记录，得到作者邮箱、姓名与全部共同作者邮箱。 */
function parseCommit(record) {
  const first = record.indexOf(FIELD_SEP);
  if (first < 0) return null;

  const second = record.indexOf(FIELD_SEP, first + 1);
  const authorEmail = record.slice(0, first).trim().toLowerCase();
  const authorName = second < 0 ? '' : record.slice(first + 1, second).trim();
  const body = second < 0 ? '' : record.slice(second + 1);

  const emails = new Set(authorEmail ? [authorEmail] : []);
  for (const line of body.split('\n')) {
    const match = CO_AUTHOR.exec(line);
    if (match) emails.add(match[1].trim().toLowerCase());
  }
  return {authorEmail, authorName, emails: [...emails]};
}

/** 读取单个文件跟随改名后的提交历史，失败时返回空数组。 */
function readCommits(filePath) {
  let output;
  try {
    output = git(['log', '--follow', '--no-merges', LOG_FORMAT, '--', filePath]);
  } catch (error) {
    console.error(`  ✗ ${filePath}: ${error.message.split('\n')[0]}`);
    return [];
  }
  return output.split(RECORD_SEP).map(parseCommit).filter(Boolean);
}

/** 把邮箱解析成身份，映射表未收录时用该次提交的 git 姓名兜底。 */
function resolveIdentity(email, commit, map) {
  const known = map.get(email);
  if (known) return isBot(known.name) ? null : known;
  if (!commit.authorName || isBot(commit.authorName)) return null;
  return {name: commit.authorName, githubUsername: null, profileUrl: null};
}

/** 新建贡献者条目，头像取 avatars CDN 以便账号注销后仍可访问。 */
function createPerson(identity) {
  return {
    login: identity.githubUsername || identity.name,
    name: identity.name,
    html_url: identity.profileUrl,
    avatar_url: identity.githubUsername
      ? `https://avatars.githubusercontent.com/${identity.githubUsername}?size=64`
      : null,
    contributions: 0,
  };
}

/** 同一贡献者按 GitHub 账号归并，没有账号时退回 git 姓名。 */
function identityKey(identity) {
  return identity.githubUsername
    ? `gh:${identity.githubUsername.toLowerCase()}`
    : `name:${identity.name.toLowerCase()}`;
}

/** 汇总单个文件的贡献者，按提交次数降序、账号名升序排序。 */
function buildContributors(commits, map, unknown) {
  const people = new Map();
  for (const commit of commits) {
    for (const email of commit.emails) {
      const identity = resolveIdentity(email, commit, map);
      if (!identity) continue;
      if (!map.has(email)) {
        if (!unknown.has(email)) unknown.set(email, new Set());
        unknown.get(email).add(identity.name);
      }
      const key = identityKey(identity);
      const person = people.get(key) || createPerson(identity);
      person.contributions += 1;
      people.set(key, person);
    }
  }
  return [...people.values()].sort(
    (a, b) => b.contributions - a.contributions || a.login.localeCompare(b.login, 'en'),
  );
}

/** 逐文件生成数据并写入 JSON，最后汇报统计与未收录的邮箱。 */
function main() {
  ensureFullHistory();
  const map = loadMap();
  const files = SOURCE_DIRS.flatMap(collectMarkdownFiles);
  console.log(`共 ${files.length} 个文档文件待处理（本地 git 历史，无需网络）。`);

  const unknown = new Map();
  const data = {};
  let totalCommits = 0;
  const startedAt = Date.now();

  files.forEach((filePath, index) => {
    const commits = readCommits(filePath);
    totalCommits += commits.length;

    const contributors = buildContributors(commits, map, unknown);
    if (contributors.length > 0) data[filePath] = contributors;

    const done = index + 1;
    if (done % 20 === 0 || done === files.length) {
      console.log(`  … ${done}/${files.length}（已有贡献者 ${Object.keys(data).length} 个文件）`);
    }
  });

  fs.mkdirSync(path.dirname(OUTPUT_FILE), {recursive: true});
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(2);
  const contributors = new Set(
    Object.values(data).flatMap((list) => list.map((item) => item.login)),
  );
  console.log(
    `✓ 已写入 ${path.relative(SITE_DIR, OUTPUT_FILE)}：` +
      `${Object.keys(data).length}/${files.length} 个文件、${totalCommits} 次提交、` +
      `${contributors.size} 位贡献者（耗时 ${seconds}s）。`,
  );

  if (unknown.size === 0) return;
  console.warn(
    `\n⚠  ${unknown.size} 个邮箱不在 scripts/contributors-map.json 中，相关贡献者已退化为纯文字显示：`,
  );
  for (const [email, names] of [...unknown.entries()].sort()) {
    console.warn(`     ${email}  ← ${[...names].join(' / ')}`);
  }
  console.warn('   补进 contributors-map.json（键用邮箱小写）后重跑本脚本即可显示头像。');
}

try {
  main();
} catch (error) {
  console.error('生成贡献者数据失败：', error.message || error);
  process.exit(1);
}
