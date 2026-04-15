# LidLift MCP - Distribution Package

## Live Endpoints

**MCP Server**: https://mcp.iholt.workers.dev
**Health Check**: https://mcp.iholt.workers.dev/health
**MCP Endpoint**: https://mcp.iholt.workers.dev/mcp

## Quick Start

### Add to Your MCP Client

```json
{
  "mcpServers": {
    "lidlift": {
      "url": "https://mcp.iholt.workers.dev/mcp",
      "transport": "http"
    }
  }
}
```

### Available Tools

1. **analyze_tool_fit** - Score single tool-prompt alignment
2. **rank_tools** - Rank catalog by dissonance, return safest first

## Integration Examples

### Claude Desktop
```json
{
  "mcpServers": {
    "lidlift": {
      "url": "https://mcp.iholt.workers.dev/mcp",
      "transport": "http"
    }
  }
}
```

### OpenCode
```json
{
  "mcp": {
    "servers": {
      "lidlift": {
        "url": "https://mcp.iholt.workers.dev/mcp",
        "transport": "http"
      }
    }
  }
}
```

### Kimi / Moonshot.ai Integration

```python
import requests

def analyze_tool(prompt: str, tool: dict) -> dict:
    """Analyze tool-prompt fit using LidLift MCP"""
    response = requests.post(
        "https://mcp.iholt.workers.dev/mcp",
        json={
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "analyze_tool_fit",
                "arguments": {
                    "prompt": prompt,
                    "tool": tool
                }
            },
            "id": 1
        }
    )
    return response.json()["result"]["structuredContent"]

# Usage
result = analyze_tool(
    prompt="Show me the README from anthropics/skills",
    tool={
        "name": "gh_repo_clone",
        "description": "Clone a GitHub repository",
        "operationMode": "write"
    }
)
# Returns: dissonance score, risk level, recommendation
```

## Features

- ✅ **Real-time analysis** - Score prompt-tool fit in <100ms
- ✅ **Risk detection** - Identify destructive mismatches before execution
- ✅ **Alternative suggestions** - Get safer tool recommendations
- ✅ **Zero setup** - No API keys required for public beta
- ✅ **Cloudflare Workers** - Global edge deployment, 99.9% uptime
- ✅ **MCP compatible** - Works with Claude, OpenCode, and MCP clients

## Stats (Live)

- **Latency**: <100ms p50
- **Uptime**: 99.9% (Cloudflare SLA)
- **Tools**: 2 (analyze_tool_fit, rank_tools)
- **Sample Catalog**: 5 tools included

## Support

- **Documentation**: See `/README.md`
- **Skills**: See `/skills/` directory
- **Issues**: Report via repository issues
- **Status**: https://mcp.iholt.workers.dev/health
