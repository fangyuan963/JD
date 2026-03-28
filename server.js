const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 检查API密钥
if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
    console.error('❌ 错误: API密钥未配置！');
    console.error('请编辑 .env 文件，设置 DEEPSEEK_API_KEY');
    console.error('获取API密钥: https://platform.deepseek.com/');
    process.exit(1);
}

app.use(cors());
app.use(express.json());

// 解析JD的API端点
app.post('/api/analyze-jd', async (req, res) => {
    try {
        const { jd } = req.body;

        if (!jd) {
            return res.status(400).json({ error: 'JD内容不能为空' });
        }

        console.log('正在解析JD...');
        
        // 构建Prompt
        const prompt = `请分析以下招聘JD，并按照指定格式返回六块内容。注意：回答中不要使用星号（*），所有内容都要基于JD原文，不可凭空捏造。

【JD内容】：
${jd}

请按照以下格式返回：

【一句话看懂（大白话）】：
用一句话总结这个岗位的核心要求和工作内容，使用通俗易懂的大白话。

【要做的三件事（大白话）】：
列出这个岗位最重要的三项工作职责，使用通俗易懂的大白话描述。

【硬门槛/可培养/加分项】：
硬门槛：必须逐句分析JD原文，提取所有明确要求，包括：
1. 学历要求：JD中明确提到的学历要求（如本科及以上学历、硕士学历等）
2. 工作年限：JD中明确提到的工作经验要求（如3年以上、5-8年等）
3. 专业技能：JD中明确要求的"熟练掌握"、"精通"、"必须掌握"的技能（如Python、Java、SQL等）
4. 证书资质：JD中明确要求持有的证书（如CPA、PMP、教师资格证、英语六级等）
5. 工具软件：JD中明确要求的工具或软件（如Excel、Photoshop、JIRA等）
6. 其他要求：JD中明确提到的其他必要条件（如年龄、专业、语言能力等）

重要提示：
- 必须基于JD原文逐句提取，不可遗漏
- 如果JD中某类要求未提及，则标注"JD中未明确提及"
- 不可随意添加JD中没有的要求
- 格式：要求类型 + 原文内容 + 大白话说明

可培养：列出JD中提到的"了解"、"熟悉"、"有基础即可"等可以入职后学习的能力
加分项：列出JD中提到的"优先"、"加分"、"有更好"等条件，不可凭空捏造

【翻译＋例子（大白话）】：
从JD原文中选择3-5个句子或段落，用大白话重新翻译这些句子，并给出实际工作例子。不要只翻译术语，而是翻译完整的句子。
格式：
原文句子：[JD中的原句]
大白话翻译：[用通俗易懂的语言重新表达]
实际例子：[工作中如何体现]

【面试反问三个问题】：
基于这个JD，给出3个面试时可以反问面试官的好问题。

【面试可能被问三个问题】：
基于这个JD，预测3个面试官可能会问的问题。`;

        // 调用DeepSeek API
        const response = await axios.post(
            process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
            {
                model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: '你是一个专业的JD分析助手。你的任务是严格按照JD原文提取信息，不可遗漏任何明确要求，也不可添加JD中没有的内容。在分析硬门槛时，必须逐句检查JD原文，确保所有必要条件都被提取出来。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 3000
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
                },
                timeout: 60000 // 60秒超时
            }
        );

        const aiResponse = response.data.choices[0].message.content;
        
        // 解析AI返回的内容
        const parsedResult = parseAIResponse(aiResponse);
        
        res.json({
            success: true,
            data: parsedResult,
            rawResponse: aiResponse
        });

    } catch (error) {
        console.error('解析JD失败:', error.response?.data || error.message);
        
        let errorMessage = '解析失败';
        if (error.response?.status === 401) {
            errorMessage = 'API密钥无效，请检查配置';
        } else if (error.response?.status === 429) {
            errorMessage = '请求过于频繁，请稍后再试';
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = '请求超时，请检查网络连接';
        } else {
            errorMessage = error.response?.data?.error?.message || error.message;
        }

        res.status(500).json({
            error: errorMessage,
            details: error.response?.data || error.message
        });
    }
});

// 解析AI返回的内容
function parseAIResponse(response) {
    const result = {
        summary: '',
        tasks: [],
        requirements: {
            required: [],
            trainable: [],
            bonus: []
        },
        translation: {
            translations: []
        },
        questions: [],
        interviewQuestions: []
    };

    try {
        // 提取一句话看懂
        const summaryMatch = response.match(/【一句话看懂（大白话）】[:：]\s*\n?([^【]+)/);
        if (summaryMatch) {
            result.summary = summaryMatch[1].trim();
        }

        // 提取要做的三件事
        const tasksMatch = response.match(/【要做的三件事（大白话）】[:：]\s*\n?([^【]+)/);
        if (tasksMatch) {
            const tasksText = tasksMatch[1].trim();
            result.tasks = tasksText.split(/\n/).filter(line => line.trim()).slice(0, 3);
        }

        // 提取硬门槛/可培养/加分项
        const reqMatch = response.match(/【硬门槛\/可培养\/加分项】[:：]\s*\n?([^【]+)/);
        if (reqMatch) {
            const reqText = reqMatch[1].trim();
            
            // 尝试提取硬门槛
            const requiredMatch = reqText.match(/硬门槛[:：]\s*\n?([^可]+)/);
            if (requiredMatch) {
                result.requirements.required = requiredMatch[1].split(/\n/).filter(line => line.trim() && !line.includes('可培养'));
            }
            
            // 尝试提取可培养
            const trainableMatch = reqText.match(/可培养[:：]\s*\n?([^加]+)/);
            if (trainableMatch) {
                result.requirements.trainable = trainableMatch[1].split(/\n/).filter(line => line.trim() && !line.includes('加分项'));
            }
            
            // 尝试提取加分项
            const bonusMatch = reqText.match(/加分项[:：]\s*\n?(.+)/s);
            if (bonusMatch) {
                result.requirements.bonus = bonusMatch[1].split(/\n/).filter(line => line.trim());
            }
        }

        // 提取翻译＋例子
        const transMatch = response.match(/【翻译＋例子（大白话）】[:：]\s*\n?([^【]+)/);
        if (transMatch) {
            const transText = transMatch[1].trim();
            // 解析新的格式：原文句子、大白话翻译、实际例子
            const lines = transText.split(/\n/).filter(line => line.trim());
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // 检查是否是原文句子行
                if (line.startsWith('原文句子：') || line.startsWith('原文句：')) {
                    const originalText = line.replace(/^(原文句子：|原文句：)/, '').trim();
                    
                    // 查找接下来的大白话翻译和实际例子
                    const translationLine = lines[i + 1] || '';
                    const exampleLine = lines[i + 2] || '';
                    
                    const translation = translationLine.startsWith('大白话翻译：') 
                        ? translationLine.replace(/^大白话翻译：/, '').trim() 
                        : '';
                    const example = exampleLine.startsWith('实际例子：') 
                        ? exampleLine.replace(/^实际例子：/, '').trim() 
                        : '';
                    
                    if (originalText) {
                        result.translation.translations.push({
                            term: originalText,
                            explanation: translation,
                            example: example
                        });
                    }
                    
                    // 跳过已处理的行
                    i += 2;
                }
            }
        }

        // 提取面试反问三个问题
        const questionsMatch = response.match(/【面试反问三个问题】[:：]\s*\n?([^【]+)/);
        if (questionsMatch) {
            const questionsText = questionsMatch[1].trim();
            result.questions = questionsText.split(/\n/).filter(line => line.trim()).slice(0, 3);
        }

        // 提取面试可能被问三个问题
        const interviewMatch = response.match(/【面试可能被问三个问题】[:：]\s*\n?([^【]*)/);
        if (interviewMatch) {
            const interviewText = interviewMatch[1].trim();
            result.interviewQuestions = interviewText.split(/\n/).filter(line => line.trim()).slice(0, 3);
        }

    } catch (error) {
        console.error('解析AI响应失败:', error);
    }

    return result;
}

// 健康检查
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Server is running',
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 服务器启动成功！`);
    console.log(`📍 地址: http://localhost:${PORT}`);
    console.log(`🔍 健康检查: http://localhost:${PORT}/health`);
    console.log(`🤖 模型: ${process.env.DEEPSEEK_MODEL || 'deepseek-chat'}`);
    console.log();
    console.log('按 Ctrl+C 停止服务器');
    console.log();
});