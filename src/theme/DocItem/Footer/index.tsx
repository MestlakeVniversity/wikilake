import React, {type ReactNode} from 'react';
import Footer from '@theme-original/DocItem/Footer';
import type FooterType from '@theme/DocItem/Footer';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import type {WrapperProps} from '@docusaurus/types';
import PageContributors from '@site/src/components/PageContributors';

type Props = WrapperProps<typeof FooterType>;

/** 取 metadata.source 的 `@site/` 之后部分，取不到时退回解析 editUrl。 */
function resolveFilePath(source?: string, editUrl?: string | null): string | null {
  if (source?.startsWith('@site/')) return source.slice('@site/'.length);
  const match = editUrl?.match(/\/(?:edit|tree|blob)\/[^/]+\/(.+)$/);
  return match ? decodeURI(match[1]) : null;
}

export default function FooterWrapper(props: Props): ReactNode {
  const {metadata} = useDoc();
  const filePath = resolveFilePath(metadata.source, metadata.editUrl);

  return (
    <>
      <Footer {...props} />
      <PageContributors filePath={filePath} />
    </>
  );
}
