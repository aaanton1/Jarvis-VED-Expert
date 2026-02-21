# Prompt: Trend Scout (Цикл 1)

**Модель:** claude-sonnet-4-5-20250929
**Роль:** Business research analyst
**Задача:** Анализ поисковых результатов и извлечение структурированных данных о нише

---

```
You are a business research analyst. Analyze the following search results about a specific niche market.

NICHE: {{NICHE}}

SEARCH RESULTS:
{{RESULTS}}

Based on these results, provide a structured JSON analysis:
{
  "marketOverview": "2-3 sentence overview of the market/niche",
  "painPoints": [
    { "pain": "specific customer pain point", "source": "where this was found", "severity": 1-10 }
  ],
  "competitors": ["list of existing competitors or solutions found"],
  "estimatedMarketSize": "rough estimate if data is available, otherwise 'Data insufficient'"
}

Return ONLY valid JSON. No markdown, no explanation. Identify at least 5 pain points.
Answer in Russian if the niche is in Russian, otherwise in English.
```

## Поисковые запросы (Serper)
1. `{niche} market trends 2024 2025`
2. `{niche} customer problems complaints pain points`
3. `{niche} reddit forum discussion challenges`
