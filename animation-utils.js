// @ts-check
// -*- coding: utf-8 -*-

function calculateAnimationData(quote, author, animationSpeed = 0.1) {
    const MAX_CHARS_PER_LINE = 10 // 每行最大字符数
	const delimiters = ["，", "。", "？", "、", "：", "！", "；", ",", "."]
	let quoteLines = quote
		.split(new RegExp(`[${delimiters.join("")}]`, "g"))
		.map((line) => line.trim())
		.filter((q) => q.length > 0)

        let processedLines = []
	quoteLines.forEach((line) => {
		// 如果这一行超过最大长度，需要分割
		if (line.length > MAX_CHARS_PER_LINE) {
			// 每 MAX_CHARS_PER_LINE 个字符分割一次
			for (let i = 0; i < line.length; i += MAX_CHARS_PER_LINE) {
				const subLine = line.slice(i, i + MAX_CHARS_PER_LINE)
				processedLines.push(subLine)
			}
		} else {
			processedLines.push(line)
		}
	})

	// 如果没有任何内容，使用原始文本
	if (processedLines.length === 0) {
		processedLines = [quote.trim()]
	}

	const authorText = [...author]

	let accumulatedDelay = 0
	const quoteLineData = processedLines.map((line) => {
		const lineData = {
			text: line,
			delay: accumulatedDelay,
			duration: line.length * animationSpeed,
		}
		// 每行之间间隔 2 个 animationSpeed
		accumulatedDelay += (line.length + 2) * animationSpeed
		return lineData
	})

	const baseDuration = accumulatedDelay + authorText.length * animationSpeed

	return {
		quoteLineData,
		authorText,
		baseDuration,
	}
}

module.exports = { calculateAnimationData }
