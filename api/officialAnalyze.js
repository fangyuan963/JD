export default async function handler(req, res) {
  try {
    const { text } = await req.json();

    // 读取 Vercel 环境变量里的 Key
    const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

    const response = await fetch('https://官方-deepseek-api-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`
      },
      body: JSON.stringify({ text })
    });

    const data = await response.json();
    res.status(200).json({ result: data.result });

  } catch (error) {
    console.error(error);
    res.status(500).json({ result: '解析失败，请稍后重试' });
  }
}