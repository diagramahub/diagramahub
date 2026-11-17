import { describe, expect, it } from 'vitest';
import { API_KEY_AREAS, API_REFERENCE, AREA_LEVELS, RECIPES, agentContext, grantedAreas, matchingPreset, presetPermissions, snippet } from '../apiKeys';

describe('API key permissions', () => {
  it('presets leave AI off', () => {
    expect(presetPermissions('read')).toEqual({ projects: 'read', diagrams: 'read', sharing: 'read', community: 'read', ai: 'none' });
    expect(matchingPreset(presetPermissions('write'))).toBe('write');
    expect(matchingPreset({ ...presetPermissions('read'), diagrams: 'write' })).toBeNull();
  });

  it('lists only the areas with access', () => {
    expect(grantedAreas({ projects: 'read', diagrams: 'none', sharing: 'none', community: 'write', ai: 'none' })).toEqual([
      ['projects', 'read'],
      ['community', 'write'],
    ]);
  });

  it('documents only levels each area can have', () => {
    for (const entry of [...API_REFERENCE, ...RECIPES]) {
      for (const area of entry.areas) {
        expect(API_KEY_AREAS).toContain(area);
        expect(AREA_LEVELS[area]).toContain(entry.level);
      }
      expect(entry.level).toBe(entry.method === 'GET' ? 'read' : 'write');
    }
  });
});

describe('snippet', () => {
  const recipe = { method: 'PUT' as const, path: '/diagrams/D1', body: { description: "it's new", public: true } };

  it('builds a curl call with the key from the environment', () => {
    expect(snippet(recipe, 'https://api.example.com/api/v1', 'curl')).toBe(
      [
        'curl -X PUT "https://api.example.com/api/v1/diagrams/D1" \\',
        '  -H "Authorization: Bearer $DIAGRAMAHUB_API_KEY" \\',
        '  -H "Content-Type: application/json" \\',
        `  -d '{"description":"it'\\''s new","public":true}'`,
      ].join('\n'),
    );
  });

  it('builds JavaScript and Python calls', () => {
    const js = snippet(recipe, 'https://x/api/v1', 'javascript');
    expect(js).toContain('await fetch("https://x/api/v1/diagrams/D1"');
    expect(js).toContain('process.env.DIAGRAMAHUB_API_KEY');
    const py = snippet(recipe, 'https://x/api/v1', 'python');
    expect(py).toContain('requests.put(');
    expect(py).toContain('"public": True');
    expect(snippet({ method: 'GET', path: '/projects' }, 'https://x/api/v1', 'python')).not.toContain('json=');
  });
});

describe('agentContext', () => {
  const t = (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key);
  const doc = agentContext(t, 'https://dh.example.com/api/v1');

  it('has the base URL, auth from the environment and no key', () => {
    expect(doc).toContain('`https://dh.example.com/api/v1`');
    expect(doc).toContain('Authorization: Bearer $DIAGRAMAHUB_API_KEY');
    expect(doc).not.toMatch(/dh_pat_[A-Za-z0-9]/);
  });

  it('lists every documented endpoint with its permission, and every task with an example', () => {
    for (const ep of API_REFERENCE) expect(doc).toContain(`\`${ep.method} ${ep.path}\``);
    for (const r of RECIPES) expect(doc).toContain(`apiKeys.recipes.${r.key}.title`);
    expect(doc).toContain('(`community:write`, `diagrams:write`)');
    expect(doc.match(/```bash/g)).toHaveLength(RECIPES.length);
  });

  it('documents the permission levels per area', () => {
    expect(doc).toContain('| `ai` | `none`, `write` |');
    expect(doc).toContain('`ai-data`');
  });
});
