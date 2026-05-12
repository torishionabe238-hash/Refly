import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { diaries } = await req.json()

  if (!diaries || diaries.length === 0) {
    return new Response(
      JSON.stringify({ error: '日記がありません' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const client = new Anthropic()

  const diaryList = diaries
    .map((d: any) => `[ID:${d.id}] ${d.date}\n${d.content}`)
    .join('\n\n---\n\n')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `以下の日記の中から、友人や職場の人との会話で「話のタネ」として使いやすいものを最大5件選んでください。

## 選ぶ基準
- 具体的なエピソードがある（出来事・体験・発見）
- 笑える・共感される・驚きがある・感動的 のいずれかに当てはまる
- 抽象的な気持ちだけの記述は除く

## 出力形式（必ずJSONのみで返してください）
{
  "recommendations": [
    {
      "diary_id": "（日記のID）",
      "hook": "（15字以内でネタの一言説明）",
      "reason": "（なぜ話せるネタになるか、40字以内）",
      "category": "笑える" | "共感" | "驚き" | "感動" | "学び"
    }
  ]
}

## 日記一覧
${diaryList}`,
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { recommendations: [] }

  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
