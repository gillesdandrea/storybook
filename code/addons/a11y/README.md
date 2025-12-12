# Storybook Accessibility Addon

The @storybook/addon-a11y package provides accessibility testing for Storybook stories. It supports two accessibility testing engines:

- **axe-core** (default): Industry-standard accessibility testing engine
- **IBM Equal Access**: IBM's comprehensive accessibility checker

You can configure which engine to use based on your project's requirements.

## Getting Started

### Add the addon to an existing Storybook

```bash
npx storybook add @storybook/addon-a11y
```

[More on getting started with the accessibility addon](https://storybook.js.org/docs/writing-tests/accessibility-testing#accessibility-checks-with-a11y-addon?ref=readme)

## Understanding Results

The addon displays accessibility test results in three tabs:

### Violations Tab
Issues that fail accessibility rules and must be fixed.

**axe-core severity badges:**
- 🔴 **Critical** - Critical impact, blocks many users (red badge)
- 🔴 **Serious** - Serious impact, blocks many users (red badge)
- 🟡 **Moderate** - Moderate impact, blocks some users (yellow badge)
- 🔵 **Minor** - Minor impact, inconveniences some users (blue badge)

**IBM Equal Access severity badges:**
- 🔴 **Violation** - Policy violation that failed automated checks (red badge)
- 🔵 **Recommendation** - Best practice recommendation that failed automated checks (blue badge)
- 🟠 **Needs Review** - Manual verification required (orange badge)

### Passes Tab
Rules that passed accessibility checks. No severity badges are displayed.

### Inconclusive Tab
Issues that require manual review to determine if they are violations.

**axe-core severity badges:**
- Shows the rule's potential impact if it were to fail (Critical, Serious, Moderate, Minor)

**IBM Equal Access severity badges:**
- 🔴 **Potential Violation** - Possible violation requiring manual review (red badge)
- 🔵 **Potential Recommendation** - Possible recommendation requiring manual review (blue badge)
- 🟠 **Needs Review** - Manual verification required (orange badge)

### Badge Colors

**axe-core:**
- 🔴 **Red**: Critical/serious violations requiring immediate attention
- 🟡 **Yellow**: Moderate issues
- 🔵 **Blue**: Minor issues

**IBM Equal Access:**
- 🔴 **Red**: Violations and potential violations
- 🔵 **Blue**: Recommendations and potential recommendations
- 🟠 **Orange**: Items requiring manual review

## Engine-Specific Behavior

### axe-core
- Uses **impact** levels: critical, serious, moderate, minor
- Violations show the actual impact of the failure
- Incomplete results show the rule's potential impact (what severity it would have if confirmed as a violation)

### IBM Equal Access
- Uses **policy** levels: violation, recommendation
- Uses **confidence** levels: fail, potential, manual
- **Violations tab**: Shows violations and recommendations that failed automated checks (FAIL confidence)
- **Inconclusive tab**: Shows potential violations, potential recommendations, and items requiring manual review (POTENTIAL or MANUAL confidence)
- Displays IBM-specific severity labels

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).
