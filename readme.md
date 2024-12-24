一款将文字转为竖排展示图片和视频的工具。

演示图：

![example](./examples/1.jpg)

<video width="320" height="240" controls>
 <source src="./examples/1.mp4" type="video/mp4">
</video>

如果以下报错：

```
throw new Error(`Could not find Chrome (ver. ${this.puppeteer.browserVersion}). This can occur if either\n` +
```

请执行下面的命令安装 chrome：

```sh
npx puppeteer browsers install chrome
```
