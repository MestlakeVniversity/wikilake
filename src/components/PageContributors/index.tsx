import React, {type ReactNode, useEffect, useState} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './styles.module.css';

interface Contributor {
  /** GitHub 账号，没有账号时为 git 姓名 */
  login: string;
  /** 为 null 时渲染成不可点击的纯文字 */
  html_url: string | null;
  avatar_url: string | null;
  contributions?: number;
}

interface PageContributorsProps {
  /** 源文件相对仓库根的路径，例如 `docs/intro.md` */
  filePath?: string | null;
}

type ContributorMap = Record<string, Contributor[]>;

const AVATAR_SIZE = 64;

/** 整份数据在会话内只取一次，失败则下次重新尝试。 */
let pending: Promise<ContributorMap | null> | null = null;

/** 取最新数据，失败时返回 null 即不渲染，不抛错。 */
function loadContributors(url: string): Promise<ContributorMap | null> {
  if (!pending) {
    pending = fetch(url, {priority: 'low'})
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => (data && typeof data === 'object' ? (data as ContributorMap) : null))
      .catch(() => null)
      .then((data) => {
        if (!data) pending = null;
        return data;
      });
  }
  return pending;
}

function ContributorCard({contributor}: {contributor: Contributor}): ReactNode {
  const content = (
    <>
      {contributor.avatar_url && (
        <img
          className={styles.avatar}
          src={contributor.avatar_url}
          alt=""
          width={AVATAR_SIZE}
          height={AVATAR_SIZE}
          loading="lazy"
          decoding="async"
        />
      )}
      <span className={styles.login}>{contributor.login}</span>
      {contributor.contributions && (
        <span className={styles.visuallyHidden}>
          ，{contributor.contributions} 次提交
        </span>
      )}
    </>
  );

  return (
    <li className={styles.item}>
      {contributor.html_url ? (
        <a
          href={contributor.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}>
          {content}
        </a>
      ) : (
        <span className={styles.link}>{content}</span>
      )}
    </li>
  );
}

export default function PageContributors({filePath}: PageContributorsProps): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  const dataUrl = (siteConfig.customFields?.contributorsUrl as string) || '';
  const [data, setData] = useState<ContributorMap | null>(null);

  useEffect(() => {
    if (!dataUrl) return;
    let active = true;
    loadContributors(dataUrl).then((next) => {
      if (active) setData(next);
    });
    return () => {
      active = false;
    };
  }, [dataUrl]);

  const contributors = filePath && data ? data[filePath] : undefined;
  if (!contributors?.length) return null;

  return (
    <section className={styles.contributors}>
      <h2 className={styles.title}>本页面贡献者（{contributors.length}）</h2>
      <ul className={styles.list} role="list">
        {contributors.map((contributor) => (
          <ContributorCard key={contributor.login} contributor={contributor} />
        ))}
      </ul>
    </section>
  );
}
