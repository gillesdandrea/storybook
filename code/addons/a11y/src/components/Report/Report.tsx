import type { FC } from 'react';
import React from 'react';

import { Badge, Button, EmptyTabContent } from 'storybook/internal/components';

import { ChevronSmallDownIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import { RuleType } from '../../types';
import type { EnrichedIssue } from '../../display/types';
import { Details } from './Details';

const Wrapper = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  borderBottom: `1px solid ${theme.appBorderColor}`,
  containerType: 'inline-size',
  fontSize: theme.typography.size.s2,
}));

const Icon = styled(ChevronSmallDownIcon)({
  transition: 'transform 0.1s ease-in-out',
});

const HeaderBar = styled.div(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px 6px 15px',
  minHeight: 40,
  background: 'none',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  width: '100%',
  '&:hover': {
    color: theme.color.secondary,
  },
}));

const Title = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  flexGrow: 1,
  fontSize: theme.typography.size.s2,
  gap: 8,
}));

const RuleId = styled.div(({ theme }) => ({
  color: theme.textMutedColor,
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1,
  display: 'block',
}));

const Count = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.textMutedColor,
  width: 28,
  height: 28,
}));

export interface ReportProps {
  items: EnrichedIssue[];
  empty: string;
  type: RuleType;
  handleSelectionChange: (key: string) => void;
  selectedItems: Map<string, string>;
  toggleOpen: (event: React.SyntheticEvent<Element>, type: RuleType, item: EnrichedIssue) => void;
}

export const Report: FC<ReportProps> = ({
  items,
  empty,
  type,
  handleSelectionChange,
  selectedItems,
  toggleOpen,
}) => (
  <>
    {items && items.length ? (
      items.map((item) => {
        const id = `${type}.${item.id}`;
        const detailsId = `details:${id}`;
        const selection = selectedItems.get(id);
        console.log('[Report] Rendering item:', {
          type,
          itemId: item.id,
          itemRuleId: item.ruleId,
          generatedId: id,
          selection,
          selectedItemsKeys: Array.from(selectedItems.keys()),
          severity: item.severity,
          engineLabel: item.severity.engineLabel,
          label: item.severity.label,
        });
        return (
            <Wrapper key={id}>
              <HeaderBar onClick={(event) => toggleOpen(event, type, item)} data-active={!!selection}>
                <Title>
                  <strong>{item.displayTitle}</strong>
                  <RuleId>{item.id}</RuleId>
                </Title>
              {type !== RuleType.PASS && (
                <Badge status={item.severity.badgeStatus}>
                  {item.severity.engineLabel || item.severity.label}
                </Badge>
              )}
              <Count>{item.nodes.length}</Count>
              <Button
                onClick={(event) => toggleOpen(event, type, item)}
                ariaLabel={`${selection ? 'Collapse' : 'Expand'} details for: ${item.displayTitle}`}
                aria-expanded={!!selection}
                aria-controls={detailsId}
                variant="ghost"
                padding="small"
              >
                <Icon style={{ transform: `rotate(${selection ? -180 : 0}deg)` }} />
              </Button>
            </HeaderBar>
            {selection ? (
              <Details
                id={detailsId}
                item={item}
                type={type}
                selection={selection}
                handleSelectionChange={handleSelectionChange}
              />
            ) : (
              <div id={detailsId} />
            )}
          </Wrapper>
        );
      })
    ) : (
      <EmptyTabContent title={empty} />
    )}
  </>
);
