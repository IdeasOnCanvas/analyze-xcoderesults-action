# CLI Usage for xcresulttool

You can now analyze xcresult bundles directly from the command line using the built-in CLI wrapper.

## Installation

No additional installation needed if you already have this project set up:

```bash
git clone <repository>
cd analyze-xcoderesults-action
npm install
```

## Usage

### Quick Start

```bash
# Analyze an xcresult bundle (full analysis)
npm run cli ./path/to/TestResults.xcresult

# Or using npx directly
npx ts-node src/cli.ts ./path/to/TestResults.xcresult
```

### Available Commands

| Command | Description | Output |
|---------|-------------|---------|
| `analyze` | Full analysis with summary and annotations (default) | Human-readable report |
| `summary` | Just the markdown summary | Markdown tables |
| `metrics` | Raw metrics | JSON object |
| `conclusion` | Overall result determination | `success` or `failure` |
| `annotations` | GitHub-style annotations | JSON array |

### Examples

```bash
# Full analysis (default)
npm run cli ./TestResults.xcresult
npm run cli ./TestResults.xcresult analyze

# Get just the markdown summary
npm run cli ./TestResults.xcresult summary

# Get raw metrics as JSON
npm run cli ./TestResults.xcresult metrics

# Check if tests passed or failed
npm run cli ./TestResults.xcresult conclusion

# Get annotations for CI/tooling integration
npm run cli ./TestResults.xcresult annotations
```

### Sample Output

#### Full Analysis (`analyze`)
```
🔍 Analyzing xcresult bundle...

📊 **Metrics:**
   Tests: 1/2 passed
   Errors: 0
   Warnings: 1
   Overall: failure

## Summary
🔨 Build finished with **0** Errors and **1** Warnings
🧪 1/2 tests passed

## Tests
|Tests Total 🧪|Tests Passed ✅|Tests Failed ⛔️|
|:---------------|:----------------|:------------|
| 2 | 1 | 1 |

🚨 **Annotations (1):**
1. [FAILURE] testExample() failed
   MyFrameworkTests.swift:22 - XCTAssertTrue failed - Some Failure Text
```

#### Metrics JSON (`metrics`)
```json
{
  "testsTotal": 2,
  "testsFailed": 1,
  "testsPassed": 1,
  "warnings": 1,
  "errors": 0
}
```

## Integration with Scripts

You can easily integrate this into your build scripts:

```bash
#!/bin/bash

# Run Xcode tests and generate xcresult
xcodebuild test -scheme MyApp -resultBundlePath TestResults.xcresult

# Analyze results
RESULT=$(npm run cli TestResults.xcresult conclusion)

if [ "$RESULT" = "failure" ]; then
    echo "❌ Tests failed!"
    npm run cli TestResults.xcresult analyze
    exit 1
else
    echo "✅ Tests passed!"
fi
```

## CI/CD Usage

For CI systems, you might want JSON output:

```bash
# Get metrics for further processing
METRICS=$(npm run cli TestResults.xcresult metrics)
echo "Test metrics: $METRICS"

# Get annotations for code review tools
ANNOTATIONS=$(npm run cli TestResults.xcresult annotations)
echo "Code annotations: $ANNOTATIONS"
```

This CLI gives you the same powerful xcresult analysis capabilities as the GitHub Action, but usable in any context where you have Node.js available.