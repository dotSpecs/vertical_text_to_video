// @ts-check
// -*- coding: utf-8 -*-

const puppeteer = require("puppeteer")
const { calculateAnimationData } = require("./animation-utils")
const { Command } = require("commander")
const path = require("path")
const fs = require("fs").promises
const { exec } = require("child_process")
const util = require("util")
const execPromise = util.promisify(exec)

const program = new Command()

const ANIMATIONS = [
	"slide-right",
	"slide-left",
	"fade-in",
	"scale-in",
	"rotate-in",
]

const MUSIC_FILES = [
	"assets/musics/bg1.mp3",
	"assets/musics/bg2.mp3",
	"assets/musics/bg3.mp3",
]

const BACKGROUND_COLORS = [
	"#3498db", // 柔和的蓝色
	"#2ecc71", // 清新的绿色
	"#e74c3c", // 温暖的红色
	"#f5b642", // 柔和的黄色
	"#9b59b6", // 优雅的紫色
	"#1abc9c", // 青绿色
	"#34495e", // 深蓝灰色
	"#e67e22", // 橙色
	"#16a085", // 深青色
	"#d35400", // 深橙色
	"#27ae60", // 翠绿色
	"#2980b9", // 深蓝色
	"#8e44ad", // 深紫色
	"#c0392b", // 深红色
	"#f39c12", // 金色
]

program
	.option("--quote <quote>", "The quote text")
	.option("--author <author>", "The author text")
	.option(
		"--tmp <tmp frames directory>",
		"The output directory for frames",
		"./tmp"
	)
	.option("--final-output <finalOutput>", "The final video output path")
	.option(
		"--font <font>",
		"The font URL or path",
		"assets/fonts/MingChao.TTF"
	)
	.option("--color <color>", "The text color", "#FFFFFF")
	.option("--bg-color <bgColor>", "The background color")
	.option("--animation <animation>", "The animation type")
	.option("--hide-qrcode", "Hide QR code")
	.option("--force", "Overwrite existing output file")

program.parse(process.argv)

const options = program.opts()

// 如果没有指定动画，随机选择一个
if (!options.animation) {
	options.animation =
		ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)]
}

// 设置默认背景颜色
const bgColor = options.bgColor || options["bg-color"]
if (!bgColor) {
	options.bgColor =
		BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)]
}

async function generateFrames() {
	const tmpDir = path.resolve(options.tmp)
	const finalOutputPath = path.resolve(options.finalOutput)
	const outputDir = path.dirname(finalOutputPath)

	// 检查输出文件是否已存在
	try {
		await fs.access(finalOutputPath)
		if (!options.force) {
			console.error(
				`错误: 输出文件 "${finalOutputPath}" 已存在。使用 --force 选项可强制覆盖。`
			)
			process.exit(1)
		}
		console.warn(`警告: 将覆盖已存在的文件 "${finalOutputPath}"`)
	} catch {
		// 文件不存在，可以继续
	}

	// 检查并创建必要的目录
	for (const dir of [tmpDir, outputDir]) {
		try {
			await fs.access(dir)
		} catch {
			await fs.mkdir(dir, { recursive: true })
		}
	}

	// 清空临时目录中的现有文件
	try {
		const existingFiles = await fs.readdir(tmpDir)
		await Promise.all(
			existingFiles.map((file) => fs.unlink(path.join(tmpDir, file)))
		)
	} catch (error) {
		console.error("清理临时目录失败:", error)
		throw error
	}

	const FPS = 30 // 每秒帧数
	const ANIMATION_SPEED = 0.5 // 动画速度
	const INITIAL_DELAY = 1.0 // 开始延迟
	const ENDING_DELAY = 1.5 // 结束延迟
	const AUTHOR_LOGO_GAP = 0.5 // author 和 logo 之间的延迟

	const browser = await puppeteer.launch({
		headless: true,
		args: ["--autoplay-policy=no-user-gesture-required"],
	})
	const page = await browser.newPage()
	await page.setViewport({ width: 1200, height: 2132 })

	let { quoteLineData, authorText, baseDuration } = calculateAnimationData(
		options.quote,
		options.author,
		ANIMATION_SPEED
	)

	// 简化防护检查
	if (!quoteLineData || !Array.isArray(quoteLineData)) {
		throw new Error("引用行数据无效")
	}

	let fontBase64 = ""
	if (options.font) {
		const fontPath = path.resolve(__dirname, options.font)
		const fontBuffer = await fs.readFile(fontPath)
		fontBase64 = fontBuffer.toString("base64")
	}

	// 获取图片的完整路径
	const logoPath = path.resolve(__dirname, "assets/images/logo.png")
	const qrcodePath = path.resolve(__dirname, "assets/images/qrcode.jpg")

	// 在读取图片文件之前添加音乐文件的读取
	const [logoBuffer, qrcodeBuffer] = await Promise.all([
		fs.readFile(logoPath),
		fs.readFile(qrcodePath),
	])

	const logoBase64 = logoBuffer.toString("base64")
	const qrcodeBase64 = qrcodeBuffer.toString("base64")

	// 更新总持续时间，加入所有必要的延迟
	let totalDuration =
		INITIAL_DELAY + // 初始延迟
		baseDuration + // 文字动画时间
		AUTHOR_LOGO_GAP + // quote和author之间的延迟
		ENDING_DELAY // 结束延迟

	// 计算总帧数
	const totalFrames = Math.ceil(totalDuration * FPS)

	// 计算最后一行文字结束的时间
	const lastLineData = quoteLineData[quoteLineData.length - 1]
	const quoteEndTime =
		lastLineData.delay + lastLineData.text.length * ANIMATION_SPEED

	// 在 HTML 模板中修改 QR code 的显示逻辑
	const qrcodeHtml = options.hideQrcode
		? ""
		: `
		<img src="data:image/jpeg;base64,${qrcodeBase64}" class="qrcode" 
			style="animation-delay: ${
				INITIAL_DELAY +
				quoteEndTime +
				AUTHOR_LOGO_GAP +
				authorText.length * ANIMATION_SPEED +
				ANIMATION_SPEED
			}s" />
	`

	const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Quote Animation</title>
            <style>
                @font-face {
                    font-family: 'CustomFont';
                    src: url(data:font/ttf;base64,${fontBase64});
                }
                body { margin: 0; padding: 0; }
                .poetry-content {
                    height: 100vh;
                    width: 100vw;
                    position: relative;
                    color: ${options.color};
                    font-family: "CustomFont", serif;
                    background-color: ${options.bgColor};
                }
                .quote-container {
                    display: flex;
                    flex-direction: row-reverse;
                    justify-content: flex-start;
                    padding: 10%;
                    height: 70%;
                    gap: 6%;
                }
                .quote-column {
                    display: flex;
                    flex-direction: column;
                    gap: 4%;
                }
                .quote-char {
                    font-size: 6.3rem;
                    writing-mode: vertical-rl;
                    text-orientation: upright;
                    white-space: nowrap;
                    line-height: 1;
                    opacity: 0;
                    display: inline-block;
                }
                .author-char {
                    display: inline-block;
                    opacity: 0;
                }
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes slideInLeft {
                    from {
                        opacity: 0;
                        transform: translateX(-30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.5);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                @keyframes rotateIn {
                    from {
                        opacity: 0;
                        transform: rotate(-180deg) scale(0.3);
                    }
                    to {
                        opacity: 1;
                        transform: rotate(0) scale(1);
                    }
                }
                .author-text {
                    position: absolute;
                    left: 10%;
                    bottom: 14%;
                    writing-mode: vertical-rl;
                    text-orientation: mixed;
                    font-size: 4.2rem;
                    letter-spacing: 0em;
                }
                .logo-area {
                    position: absolute;
                    bottom: 5.6%;
                    left: 0;
                    right: 0;
                    padding: 0 10% 0 15%;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }
                .logo {
                    width: 8%;
                    height: auto;
                    aspect-ratio: 1;
                    opacity: 0;
                    animation: fadeIn 0.8s ease forwards;
                }
                .qrcode {
                    width: 22%;
                    height: auto;
                    aspect-ratio: 1;
                    opacity: 0;
                    animation: fadeIn 0.8s ease forwards;
                }
                .quote-char.slide-right,
                .author-char.slide-right {
                    animation: slideInRight 0.8s ease forwards;
                }
                .quote-char.slide-left,
                .author-char.slide-left {
                    animation: slideInLeft 0.8s ease forwards;
                }
                .quote-char.fade-in,
                .author-char.fade-in {
                    animation: fadeIn 0.8s ease forwards;
                }
                .quote-char.scale-in,
                .author-char.scale-in {
                    animation: scaleIn 0.8s ease forwards;
                }
                .quote-char.rotate-in,
                .author-char.rotate-in {
                    animation: rotateIn 0.8s ease forwards;
                }
                .logo-area {
                    position: absolute;
                    bottom: 5.6%;
                    left: 0;
                    right: 0;
                    padding: 0 10% 0 11%;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }
                .logo {
                    width: 6.7%;
                    height: auto;
                    aspect-ratio: 1;
                    opacity: 0;
                    animation: fadeIn 0.8s ease forwards;
                }
                .qrcode {
                    width: 21.3%;
                    height: auto;
                    aspect-ratio: 1;
                    opacity: 0;
                    animation: fadeIn 0.8s ease forwards;
                }
            </style>
        </head>
        <body>
            <div class="poetry-content">
                <div class="quote-container">
                    ${quoteLineData
						.map(
							(lineData) => `
                        <div class="quote-column">
                            ${lineData.text
								.split("")
								.map(
									(char, charIndex) => `
                                <span
                                    class="quote-char ${options.animation}"
                                    style="animation-delay: ${
										INITIAL_DELAY +
										lineData.delay +
										charIndex * ANIMATION_SPEED
									}s"
                                >${char}</span>
                            `
								)
								.join("")}
                        </div>
                    `
						)
						.join("")}
                </div>
                <div class="author-text">
                    ${authorText
						.map(
							(char, index) => `
                        <span
                            class="author-char ${options.animation}"
                            style="animation-delay: ${
								INITIAL_DELAY +
								quoteEndTime +
								index * ANIMATION_SPEED
							}s"
                        >${char}</span>
                    `
						)
						.join("")}
                </div>
                <div class="logo-area">
                    <img src="data:image/png;base64,${logoBase64}" class="logo" 
                        style="animation-delay: ${
							INITIAL_DELAY +
							quoteEndTime +
							AUTHOR_LOGO_GAP +
							authorText.length * ANIMATION_SPEED
						}s" />
                    ${qrcodeHtml}
                </div>
            </div>
        </body>
        </html>
    `

	// 移除重复的图片检查代码，保留基本检查
	try {
		await fs.access(logoPath)
		await fs.access(qrcodePath)
	} catch (error) {
		console.error("Error accessing image files:", error)
		throw error
	}

	// 设置页面内容
	await page.setContent(htmlContent, {
		waitUntil: "networkidle0",
	})

	// 等待字体加载
	if (options.font) {
		await page.evaluate(async () => {
			await document.fonts.ready
			await new Promise((resolve) => setTimeout(resolve, 500))
		})
	}

	// 确保内容已加载
	await page.waitForSelector(".poetry-content", {
		visible: true,
		timeout: 5000,
	})

	let frameCount = 0
	async function generateFrame() {
		if (frameCount < totalFrames) {
			const currentTime = frameCount / FPS

			try {
				await page.evaluate((time) => {
					const elements = document.querySelectorAll(
						".quote-char, .author-char, .logo, .qrcode"
					)
					elements.forEach((el) => {
						const animations = el.getAnimations()
						animations.forEach((anim) => {
							anim.currentTime = time * 1000
						})
					})
				}, currentTime)

				await new Promise((resolve) => setTimeout(resolve, 50))

				await page.screenshot({
					path: `${options.tmp}/frame_${String(frameCount).padStart(
						4,
						"0"
					)}.png`,
					fullPage: true,
				})

				frameCount++
				await generateFrame()
			} catch (error) {
				console.error(`Error generating frame ${frameCount}:`, error)
				await browser.close()
				process.exit(1)
			}
		} else {
			await browser.close()

			const framesPath = `${options.tmp}/frame_%04d.png`
			const videoPath = `${options.tmp}/output_no_audio.mp4`
			const finalVideoPath = options.finalOutput
			const thumbnailPath = finalVideoPath.replace(/\.mp4$/, ".jpg")

			// 随机选择一个音乐文件
			const selectedMusic =
				MUSIC_FILES[Math.floor(Math.random() * MUSIC_FILES.length)]
			const musicPath = path.resolve(__dirname, selectedMusic)

			try {
				// 检查音频文件是否存在
				try {
					await fs.access(musicPath)
				} catch (error) {
					throw error
				}

				// 获取音频文件时长
				const { stdout: musicDuration } = await execPromise(
					`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${musicPath}"`
				)
				const duration = parseFloat(musicDuration)

				// 计算安全的最大起始时间
				const maxStartTime = Math.max(0, duration - totalDuration - 2)
				const startTime = Math.floor(Math.random() * maxStartTime)

				// 生成无声视频
				await execPromise(
					`ffmpeg -y -framerate ${FPS} -i ${framesPath} -c:v libx264 -pix_fmt yuv420p ${videoPath}`
				)

				// 单帧生成缩略图（使用最后一帧）
				await execPromise(
					`ffmpeg -y -i ${videoPath} -vf "select=eq(n\\,${
						totalFrames - 1
					})" -vframes 1 ${thumbnailPath}`
				)

				// 添加音频并设置淡入淡出效果
				await execPromise(
					`ffmpeg -y -i ${videoPath} -ss ${startTime} -i "${musicPath}" -c:v copy -c:a aac -filter:a "volume=1,afade=t=in:st=0:d=1,afade=t=out:st=${
						totalDuration - 1
					}:d=1" -shortest ${finalVideoPath}`
				)

				// 清理临时文件
				await execPromise(`rm ${videoPath}`)

				// 清空临时目录中的所有帧图��
				const tmpFiles = await fs.readdir(options.tmp)
				await Promise.all(
					tmpFiles.map((file) =>
						fs.unlink(path.join(options.tmp, file))
					)
				)

				process.exit(0)
			} catch (error) {
				throw error
			}
		}
	}

	await generateFrame()
}

generateFrames()
