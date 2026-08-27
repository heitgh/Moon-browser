INSERT INTO workspaces(id, data, updated_at)
VALUES (
  'workspace-default',
  json_object('id','workspace-default','name','Pessoal','position',0,'layout','standard','appearance',json('{}'),'default',json('true'),'archived',json('false'),'createdAt',unixepoch('subsec')*1000,'updatedAt',unixepoch('subsec')*1000,'lastAccessedAt',unixepoch('subsec')*1000),
  unixepoch('subsec') * 1000
)
ON CONFLICT(id) DO NOTHING;

INSERT INTO settings(id, data, updated_at)
VALUES (
  'global:theme',
  json_object('id','global:theme','key','theme','value','system','scope','global','updatedAt',unixepoch('subsec')*1000),
  unixepoch('subsec') * 1000
)
ON CONFLICT(id) DO NOTHING;
