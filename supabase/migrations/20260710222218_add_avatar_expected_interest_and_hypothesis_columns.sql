-- Aditivo, não-destrutivo: apenas adiciona colunas novas. Nenhuma coluna/linha existente é alterada.
alter table orbit.clients
  add column if not exists avatar_expected_interest text,
  add column if not exists avatar_alignment_hypothesis text;

comment on column orbit.clients.avatar_expected_interest is 'Interesse principal esperado do avatar (ex: "Performance esportiva"). Distinto de avatar_unconscious_desire.';
comment on column orbit.clients.avatar_alignment_hypothesis is 'Hipótese analítica/interpretativa sobre o desalinhamento observado, curada manualmente pela agência.';
comment on column orbit.clients.avatar_unconscious_desire is 'Desejo inconsciente hipotetizado do público (distinto de avatar_expected_interest).';
