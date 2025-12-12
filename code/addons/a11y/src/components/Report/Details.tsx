import React, { Fragment, useCallback, useState } from 'react';

import { Button, Link, SyntaxHighlighter } from 'storybook/internal/components';

import { CheckIcon, CopyIcon, LocationIcon } from '@storybook/icons';

import * as Tabs from '@radix-ui/react-tabs';
import { styled } from 'storybook/theming';

import type { RuleType } from '../../types';
import type { EnrichedIssue, DisplayNode } from '../../display/types';
import { useA11yContext } from '../A11yContext';

const StyledSyntaxHighlighter = styled(SyntaxHighlighter)(
  ({ theme }) => ({
    fontSize: theme.typography.size.s1,
  }),
  ({ language }) =>
    // We appended ' {}' to the selector in order to get proper syntax highlighting. This rule hides the last 3 spans
    // (one character each) in the displayed output. Only siblings of .selector (the actual CSS selector characters)
    // are targeted so that the code comment line isn't affected.
    language === 'css' && {
      '.selector ~ span:nth-last-of-type(-n+3)': {
        display: 'none',
      },
    }
);

const Info = styled.div({
  display: 'flex',
  flexDirection: 'column',
});

const RuleId = styled.div(({ theme }) => ({
  display: 'block',
  color: theme.textMutedColor,
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1,
  marginTop: -8,
  marginBottom: 12,

  '@container (min-width: 800px)': {
    display: 'none',
  },
}));

const Description = styled.p({
  margin: 0,
});

const Wrapper = styled.div({
  display: 'flex',
  flexDirection: 'column',
  padding: '0 15px 20px 15px',
  gap: 20,
});

const Columns = styled.div({
  gap: 15,

  '@container (min-width: 800px)': {
    display: 'grid',
    gridTemplateColumns: '50% 50%',
  },
});

const Content = styled.div<{ side: 'left' | 'right' }>(({ theme, side }) => ({
  display: side === 'left' ? 'flex' : 'none',
  flexDirection: 'column',
  gap: 15,
  margin: side === 'left' ? '15px 0' : 0,
  padding: side === 'left' ? '0 15px' : 0,
  borderLeft: side === 'left' ? `1px solid ${theme.color.border}` : 'none',

  '&:focus-visible': {
    outline: 'none',
    borderRadius: 4,
    boxShadow: `0 0 0 1px inset ${theme.color.secondary}`,
  },

  '@container (min-width: 800px)': {
    display: side === 'left' ? 'none' : 'flex',
  },
}));

const Item = styled(Button)(({ theme }) => ({
  fontFamily: theme.typography.fonts.mono,
  fontWeight: theme.typography.weight.regular,
  color: theme.textMutedColor,
  height: 40,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '0 12px',
  '&[data-state="active"]': {
    color: theme.color.secondary,
    backgroundColor: theme.background.hoverable,
  },
}));

const Messages = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

const MessageGroup = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 15,
  padding: '15px 0',
  borderTop: `1px solid ${theme.appBorderColor}`,
  '&:first-of-type': {
    borderTop: 'none',
    paddingTop: 0,
  },
}));

const MessageGroupTitle = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
  color: theme.color.defaultText,
  marginBottom: 10,
}));

const Actions = styled.div({
  display: 'flex',
  gap: 10,
});

const CopyButton = ({ onClick }: { onClick: () => void }) => {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(() => {
    onClick();
    setCopied(true);
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [onClick]);

  return (
    <Button ariaLabel={false} onClick={handleClick}>
      {copied ? <CheckIcon /> : <CopyIcon />} {copied ? 'Copied' : 'Copy link'}
    </Button>
  );
};

interface DetailsProps {
  id: string;
  item: EnrichedIssue;
  type: RuleType;
  selection: string | undefined;
  handleSelectionChange: (key: string) => void;
}

export const Details = ({ id, item, type, selection, handleSelectionChange }: DetailsProps) => {
  console.log('[Details] Rendering details:', {
    id,
    itemId: item.id,
    itemRuleId: item.ruleId,
    type,
    selection,
    nodeCount: item.nodes.length,
  });
  
  // Convert the groupedMessages Map to an array for rendering
  const nodeGroups = Array.from(item.groupedMessages.entries()).map(([message, nodes]) => ({
    message,
    nodes: nodes.map((node, index) => ({
      node,
      // Find the actual index in the original nodes array
      index: item.nodes.indexOf(node),
    })),
  }));

  // Check if we have multiple message groups (Equal Access multi-message scenario)
  const hasMultipleMessages = nodeGroups.length > 1;

  return (
    <Wrapper id={id}>
      <Info>
        <RuleId>{item.id}</RuleId>
        <Description>
          {item.displayDescription}{' '}
          {item.helpUrl && (
            <Link href={item.helpUrl} target="_blank" rel="noopener noreferrer" withArrow>
              Learn how to resolve this violation
            </Link>
          )}
        </Description>
      </Info>

      <Tabs.Root
        defaultValue={selection}
        orientation="vertical"
        value={selection}
        onValueChange={handleSelectionChange}
        asChild
      >
        <Columns>
          <Tabs.List aria-label={type}>
            {hasMultipleMessages ? (
              // Group nodes by message
              nodeGroups.map((group, groupIndex) => (
                <Fragment key={`group-${groupIndex}`}>
                  {group.message && (
                    <MessageGroupTitle>{group.message}</MessageGroupTitle>
                  )}
                  {group.nodes.map(({ node, index }) => {
                    const key = `${type}.${item.id}.${index + 1}`;
                    return (
                      <Fragment key={key}>
                        <Tabs.Trigger value={key} asChild>
                          <Item ariaLabel={false} variant="ghost" size="medium" id={key}>
                            {index + 1}. {node.html}
                          </Item>
                        </Tabs.Trigger>
                        <Tabs.Content value={key} asChild>
                          <Content side="left">{getContent(node)}</Content>
                        </Tabs.Content>
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))
            ) : (
              // Original flat list for single-message rules
              item.nodes.map((node, index) => {
                const key = `${type}.${item.id}.${index + 1}`;
                console.log('[Details] Creating node item:', {
                  index,
                  key,
                  selection,
                  matches: key === selection,
                });
                return (
                  <Fragment key={key}>
                    <Tabs.Trigger value={key} asChild>
                      <Item ariaLabel={false} variant="ghost" size="medium" id={key}>
                        {index + 1}. {node.html}
                      </Item>
                    </Tabs.Trigger>
                    <Tabs.Content value={key} asChild>
                      <Content side="left">{getContent(node)}</Content>
                    </Tabs.Content>
                  </Fragment>
                );
              })
            )}
          </Tabs.List>

          {item.nodes.map((node, index) => {
            const key = `${type}.${item.id}.${index + 1}`;
            return (
              <Tabs.Content key={key} value={key} asChild>
                <Content side="right">{getContent(node)}</Content>
              </Tabs.Content>
            );
          })}
        </Columns>
      </Tabs.Root>
    </Wrapper>
  );
};

function getContent(node: DisplayNode) {
  const { handleCopyLink, handleJumpToElement } = useA11yContext();
  const { messages, html, selector, linkPath } = node;
  
  return (
    <>
      <Messages>
        {messages.map((message) => (
          <div key={message.id}>
            {`${message.text}${/(\.|: [^.]+\.*)$/.test(message.text) ? '' : '.'}`}
          </div>
        ))}
      </Messages>

      <Actions>
        <Button ariaLabel={false} onClick={() => handleJumpToElement(selector)}>
          <LocationIcon /> Jump to element
        </Button>
        {linkPath && <CopyButton onClick={() => handleCopyLink(linkPath)} />}
      </Actions>

      {/* Technically this is HTML but we use JSX to avoid using an HTML comment */}
      <StyledSyntaxHighlighter
        language="jsx"
        wrapLongLines
      >{`/* element */\n${html}`}</StyledSyntaxHighlighter>

      {/* See note about the appended {} in the StyledSyntaxHighlighter component */}
      <StyledSyntaxHighlighter
        language="css"
        wrapLongLines
      >{`/* selector */\n${selector} {}`}</StyledSyntaxHighlighter>
    </>
  );
}
