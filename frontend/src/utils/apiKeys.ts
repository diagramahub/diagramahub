/** API keys: areas, presets and the endpoint reference shown on the API Keys page. */
import type { AccessLevel, ApiKeyArea, ApiKeyPermissions } from '../types/apiTokens';

export const API_KEY_AREAS: ApiKeyArea[] = ['projects', 'diagrams', 'sharing', 'community', 'ai'];

/** Levels each area can have (backend: permissions.AREA_LEVELS). AI has no read-only use. */
export const AREA_LEVELS: Record<ApiKeyArea, AccessLevel[]> = {
  projects: ['none', 'read', 'write'],
  diagrams: ['none', 'read', 'write'],
  sharing: ['none', 'read', 'write'],
  community: ['none', 'read', 'write'],
  ai: ['none', 'write'],
};

export type ApiKeyPreset = 'read' | 'write';

/** A level's label for an area (AI's write level reads "Use"). */
export function levelLabel(t: (key: string) => string, area: ApiKeyArea, level: AccessLevel): string {
  return area === 'ai' && level === 'write' ? t('apiKeys.levels.use') : t(`apiKeys.levels.${level}`);
}

/** Read or read-write on everything except AI (spends the user's AI quota: opt-in). */
export function presetPermissions(preset: ApiKeyPreset): ApiKeyPermissions {
  return { projects: preset, diagrams: preset, sharing: preset, community: preset, ai: 'none' };
}

/** The preset these permissions match, if any. */
export function matchingPreset(permissions: ApiKeyPermissions): ApiKeyPreset | null {
  for (const preset of ['read', 'write'] as ApiKeyPreset[]) {
    const expected = presetPermissions(preset);
    if (API_KEY_AREAS.every((area) => permissions[area] === expected[area])) return preset;
  }
  return null;
}

/** Areas with some access, in display order. */
export function grantedAreas(permissions: ApiKeyPermissions): [ApiKeyArea, AccessLevel][] {
  return API_KEY_AREAS.filter((area) => permissions[area] !== 'none').map((area) => [area, permissions[area]]);
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

type GrantedLevel = Exclude<AccessLevel, 'none'>;

/** Fixed requirements on other areas (e.g. reading the diagram whose code is exposed). */
type ExtraNeeds = [ApiKeyArea, GrantedLevel][];

export interface EndpointDoc {
  /** i18n key under apiKeys.endpoints */
  key: string;
  method: HttpMethod;
  path: string;
  /** Every area listed needs `level`. */
  areas: ApiKeyArea[];
  level: GrantedLevel;
  also?: ExtraNeeds;
}

/** Exposing a stored diagram's code (a project or folder with its diagrams, an export, AI fix, publishing, sharing) also needs to read diagrams. */
const READ_DIAGRAMS: ExtraNeeds = [['diagrams', 'read']];

const e = (key: string, method: HttpMethod, path: string, areas: ApiKeyArea[], level: GrantedLevel, also?: ExtraNeeds): EndpointDoc => ({
  key,
  method,
  path,
  areas,
  level,
  ...(also ? { also } : {}),
});

/** Every area and level an endpoint or recipe needs (backend: permissions.required_access). */
export function needsOf(entry: Pick<EndpointDoc, 'areas' | 'level' | 'also'>): [ApiKeyArea, GrantedLevel][] {
  return [...entry.areas.map((area): [ApiKeyArea, GrantedLevel] => [area, entry.level]), ...(entry.also ?? [])];
}

const needsText = (entry: Pick<EndpointDoc, 'areas' | 'level' | 'also'>) => needsOf(entry).map(([a, l]) => `\`${a}:${l}\``).join(', ');

/** What a key can call, grouped by area (backend: permissions.RULES). */
export const API_REFERENCE: EndpointDoc[] = [
  e('listProjects', 'GET', '/projects', ['projects'], 'read'),
  e('getProject', 'GET', '/projects/{project_id}', ['projects'], 'read', READ_DIAGRAMS),
  e('exportProject', 'GET', '/projects/{project_id}/export?format=zip', ['projects'], 'read', READ_DIAGRAMS),
  e('createProject', 'POST', '/projects', ['projects'], 'write'),
  e('updateProject', 'PUT', '/projects/{project_id}', ['projects'], 'write'),
  e('deleteProject', 'DELETE', '/projects/{project_id}', ['projects'], 'write'),
  e('createFolder', 'POST', '/projects/{project_id}/folders', ['projects'], 'write'),
  e('getFolder', 'GET', '/folders/{folder_id}', ['projects'], 'read', READ_DIAGRAMS),
  e('updateFolder', 'PUT', '/folders/{folder_id}', ['projects'], 'write'),
  e('deleteFolder', 'DELETE', '/folders/{folder_id}', ['projects'], 'write'),

  e('recentDiagrams', 'GET', '/diagrams/recent', ['diagrams'], 'read'),
  e('searchDiagrams', 'GET', '/diagrams/search?q={text}', ['diagrams'], 'read'),
  e('getDiagram', 'GET', '/diagrams/{diagram_id}', ['diagrams'], 'read'),
  e('createDiagram', 'POST', '/projects/{project_id}/diagrams', ['diagrams'], 'write'),
  e('updateDiagram', 'PUT', '/diagrams/{diagram_id}', ['diagrams'], 'write'),
  e('moveDiagram', 'POST', '/diagrams/{diagram_id}/move', ['diagrams'], 'write'),
  e('duplicateDiagram', 'POST', '/diagrams/{diagram_id}/duplicate', ['diagrams'], 'write'),
  e('deleteDiagram', 'DELETE', '/diagrams/{diagram_id}', ['diagrams'], 'write'),

  e('getSharedLink', 'GET', '/shared-links/diagram/{diagram_id}', ['sharing'], 'read'),
  e('createSharedLink', 'POST', '/shared-links', ['sharing'], 'write', READ_DIAGRAMS),
  e('updateSharedLink', 'PUT', '/shared-links/{link_id}', ['sharing'], 'write'),
  e('deleteSharedLink', 'DELETE', '/shared-links/{link_id}', ['sharing'], 'write'),

  e('myPublished', 'GET', '/community/my-published', ['community'], 'read'),
  e('publicationOfDiagram', 'GET', '/community/by-diagram/{diagram_id}', ['community'], 'read'),
  e('browseCommunity', 'GET', '/community/diagrams', ['community'], 'read'),
  e('publish', 'POST', '/community/diagrams', ['community'], 'write', READ_DIAGRAMS),
  e('updatePublication', 'PUT', '/community/diagrams/{publication_id}', ['community'], 'write'),
  e('unpublish', 'DELETE', '/community/diagrams/{publication_id}', ['community'], 'write'),
  e('fork', 'POST', '/community/diagrams/{publication_id}/fork', ['community', 'diagrams'], 'write'),

  e('fixDiagram', 'POST', '/diagrams/{diagram_id}/fix', ['ai'], 'write', READ_DIAGRAMS),
  e('convertDiagram', 'POST', '/diagrams/convert', ['ai'], 'write'),
];

export interface Recipe {
  /** i18n key under apiKeys.recipes */
  key: string;
  method: HttpMethod;
  path: string;
  body?: Record<string, unknown>;
  areas: ApiKeyArea[];
  level: 'read' | 'write';
  also?: ExtraNeeds;
}

/** Everyday tasks shown as copy-paste examples. */
export const RECIPES: Recipe[] = [
  { key: 'listProjects', method: 'GET', path: '/projects', areas: ['projects'], level: 'read' },
  { key: 'getProject', method: 'GET', path: '/projects/PROJECT_ID', areas: ['projects'], level: 'read', also: READ_DIAGRAMS },
  {
    key: 'updateDiagram',
    method: 'PUT',
    path: '/diagrams/DIAGRAM_ID',
    body: { content: 'flowchart LR\n  A --> B', description: '## Updated from CI' },
    areas: ['diagrams'],
    level: 'write',
  },
  {
    key: 'publish',
    method: 'POST',
    path: '/community/diagrams',
    body: { diagram_id: 'DIAGRAM_ID', category: 'architecture', tags: ['api'], allow_comments: true },
    areas: ['community'],
    level: 'write',
    also: READ_DIAGRAMS,
  },
  { key: 'unpublish', method: 'DELETE', path: '/community/diagrams/PUBLICATION_ID', areas: ['community'], level: 'write' },
  {
    key: 'share',
    method: 'POST',
    path: '/shared-links',
    body: { diagram_id: 'DIAGRAM_ID', access_type: 'public', expiration_days: 30 },
    areas: ['sharing'],
    level: 'write',
    also: READ_DIAGRAMS,
  },
  { key: 'unshare', method: 'DELETE', path: '/shared-links/LINK_ID', areas: ['sharing'], level: 'write' },
];

export type SnippetLanguage = 'curl' | 'javascript' | 'python';

const json = (value: unknown, indent: number) => JSON.stringify(value, null, indent);

/** A copy-paste example; the key comes from the DIAGRAMAHUB_API_KEY environment variable. */
export function snippet(recipe: Pick<Recipe, 'method' | 'path' | 'body'>, baseUrl: string, language: SnippetLanguage): string {
  const url = `${baseUrl}${recipe.path}`;
  if (language === 'curl') {
    const lines = [`curl -X ${recipe.method} "${url}" \\`, '  -H "Authorization: Bearer $DIAGRAMAHUB_API_KEY"'];
    if (recipe.body) {
      lines[lines.length - 1] += ' \\';
      lines.push('  -H "Content-Type: application/json" \\', `  -d '${json(recipe.body, 0).replace(/'/g, "'\\''")}'`);
    }
    return lines.join('\n');
  }
  if (language === 'javascript') {
    const options = [`  method: "${recipe.method}",`, '  headers: {', '    Authorization: `Bearer ${process.env.DIAGRAMAHUB_API_KEY}`,'];
    if (recipe.body) options.push('    "Content-Type": "application/json",');
    options.push('  },');
    if (recipe.body) options.push(`  body: JSON.stringify(${json(recipe.body, 2).replace(/\n/g, '\n  ')}),`);
    return [`const response = await fetch("${url}", {`, ...options, '});', 'console.log(response.status, await response.text());'].join('\n');
  }
  const call = [`response = requests.${recipe.method.toLowerCase()}(`, `    "${url}",`, '    headers={"Authorization": f"Bearer {os.environ[\'DIAGRAMAHUB_API_KEY\']}"},'];
  if (recipe.body) call.push(`    json=${json(recipe.body, 4).replace(/\n/g, '\n    ').replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None')},`);
  call.push(')');
  return ['import os', 'import requests', '', ...call, 'print(response.status_code, response.text)'].join('\n');
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

const COMMUNITY_CATEGORY_IDS = ['architecture', 'databases', 'business-processes', 'devops', 'uml', 'security', 'ai-data', 'education'];

/**
 * Everything an AI agent (Claude, Codex, …) needs to use the API, as Markdown:
 * base URL, auth, permissions, errors, common tasks with examples and the
 * endpoint reference. Never includes a key: the agent reads it from the
 * DIAGRAMAHUB_API_KEY environment variable.
 */
export function agentContext(t: Translate, baseUrl: string): string {
  const d = (key: string, options?: Record<string, unknown>) => t(`apiKeys.agentDoc.${key}`, options);
  const lines: string[] = [
    `# ${d('title')}`,
    '',
    d('intro'),
    '',
    `## ${d('baseUrl')}`,
    '',
    '`' + baseUrl + '`',
    '',
    `## ${d('auth')}`,
    '',
    '- `Authorization: Bearer $DIAGRAMAHUB_API_KEY`',
    '- `Content-Type: application/json`',
    `- ${d('authKey')}`,
    '',
    `## ${d('permissions')}`,
    '',
    d('permissionsIntro'),
    '',
    `| ${d('area')} | ${d('levels')} | ${d('covers')} |`,
    '|---|---|---|',
    ...API_KEY_AREAS.map((area) => `| \`${area}\` | ${AREA_LEVELS[area].map((l) => '`' + l + '`').join(', ')} | ${t(`apiKeys.areas.${area}.description`)} |`),
    '',
    d('permissionsOutside'),
    '',
    `## ${d('errors')}`,
    '',
    `- \`401\`: ${d('error401')}`,
    `- \`403\`: ${d('error403')} \`{"detail": {"error": "api_key_permission", "needs": {"projects": "write"}}}\``,
    `- \`404\`: ${d('error404')}`,
    `- \`422\`: ${d('error422')}`,
    `- \`429\`: ${d('error429')}`,
    '',
    `## ${d('tasks')}`,
    '',
  ];
  for (const recipe of RECIPES) {
    lines.push(
      `### ${t(`apiKeys.recipes.${recipe.key}.title`)}`,
      '',
      `${t(`apiKeys.recipes.${recipe.key}.description`)} (${d('needs')}: ${needsText(recipe)})`,
      '',
      '```bash',
      snippet(recipe, baseUrl, 'curl'),
      '```',
      '',
    );
  }
  lines.push(`## ${d('endpoints')}`, '', d('endpointsIntro'), '');
  for (const area of API_KEY_AREAS) {
    lines.push(`### ${t(`apiKeys.areas.${area}.name`)} (\`${area}\`)`, '');
    for (const ep of API_REFERENCE.filter((e) => e.areas[0] === area)) {
      lines.push(`- \`${ep.method} ${ep.path}\`: ${t(`apiKeys.endpoints.${ep.key}`)} (${needsText(ep)})`);
    }
    lines.push('');
  }
  lines.push(
    `## ${d('notes')}`,
    '',
    `- ${d('noteIds')}`,
    `- ${d('noteTypes')}`,
    `- ${d('noteUpdate')}`,
    `- ${d('noteCommunity', { categories: COMMUNITY_CATEGORY_IDS.map((c) => '`' + c + '`').join(', ') })}`,
    `- ${d('noteSharing')}`,
    `- ${d('noteSafety')}`,
    '',
  );
  return lines.join('\n');
}
