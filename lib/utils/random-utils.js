class RandomUtils {
    static randomIdentifier() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const length = Math.floor(Math.random() * 5) + 4; // 4-8字符
        let result = '';

        // 确保首字符不是数字
        result += chars[Math.floor(Math.random() * chars.length)];

        for (let i = 1; i < length; i++) {
            const pool = chars + '0123456789';
            result += pool[Math.floor(Math.random() * pool.length)];
        }

        return result;
    }

    static randomBool(probability = 0.5) {
        return Math.random() < probability;
    }

    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 生成随机的混淆标记
    static randomObfuscationMarker() {
        const prefixes = [
            'PROCESSED', 'COMPILED', 'OPTIMIZED', 'ENHANCED', 'TRANSFORMED',
            'MINIFIED', 'BUNDLED', 'COMPRESSED', 'ENCODED', 'SECURED',
            'GENERATED', 'BUILT', 'PACKED', 'MODIFIED', 'CONVERTED',
            'PREPARED', 'RENDERED', 'FORMATTED', 'PROTECTED', 'UPDATED'
        ];

        const suffixes = [
            'CODE', 'SCRIPT', 'DATA', 'CONTENT', 'FILE', 'RESOURCE',
            'ASSET', 'MODULE', 'COMPONENT', 'ELEMENT', 'BLOCK', 'SECTION',
            'PART', 'SEGMENT', 'PIECE', 'FRAGMENT', 'CHUNK', 'UNIT'
        ];

        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        const randomNum = this.randomInt(1000, 9999);
        const timestamp = Date.now().toString(36);

        return `${prefix}_${suffix}_${randomNum}_${timestamp}`;
    }

    // 生成随机的HTML注释标记
    static randomHtmlComment() {
        const marker = this.randomObfuscationMarker();
        return `<!-- ${marker} -->`;
    }

    // 生成随机的CSS/JS注释标记
    static randomCodeComment() {
        const marker = this.randomObfuscationMarker();
        return `/* ${marker} */`;
    }

    // 生成随机CSS类名
    static randomClassName() {
        const prefixes = ['fx', 'ui', 'app', 'css', 'cls', 'key', 'txt', 'data', 'elem', 'item'];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suffix = this.randomIdentifier();
        return `${prefix}-${suffix}`;
    }

    // 生成随机HTML属性（不使用style属性）
    static randomAttribute() {
        const attrs = [
            'data-key',
            'data-id',
            'data-value',
            'data-item',
            'data-elem',
            'class',
            'id'
        ];

        const attr = attrs[Math.floor(Math.random() * attrs.length)];
        const value = this.randomIdentifier();

        return `${attr}="${value}"`;
    }

    // 生成不可见字符
    static randomInvisibleChar() {
        const invisibleChars = [
            '&#8203;',  // 零宽空格
            '&#8204;',  // 零宽非连字符
            '&#8205;',  // 零宽连字符
            '&#8288;',  // 单词连接符
            '&#65279;', // 零宽不间断空格
        ];

        return invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
    }

    // 随机选择混淆方式（只使用不可见字符）
    static randomObfuscationMethod() {
        // 只返回不可见字符混淆方式
        return 'invisible';
    }

    // 生成指定长度的随机字符串
    static randomString(length) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }

    // 生成随机的不占位内联样式
    static randomInlineStyle() {
        const stylePool = [
            'visibility:hidden;height:0;line-height:0;font-size:0;color:transparent;',
            'height:0;width:0;overflow:hidden;position:absolute;',
            'opacity:0;position:absolute;z-index:-10000;color:transparent;',
            'opacity:0;position:absolute;left:-9999px;pointer-events:none;',
        ];
        const randomStyle = stylePool[Math.floor(Math.random() * stylePool.length)];
        return randomStyle;
    }

    // 生成一个随机的HTML文本标签
    static randomHtmlTextTag() {
        const tags = ['div', 'span', 'p', 'a', 'h1', 'h2', 'h3'];
        const tag = tags[Math.floor(Math.random() * tags.length)];
        const content = this.randomString(this.randomInt(20, 50)); // 生成20到50个字符的随机文本
        return `<${tag} class="dp_${this.randomIdentifier()}" style="${this.randomInlineStyle()}">${content}</${tag}>`;
    }

    // 生成a-b个随机的HTML文本标签
    static randomHtmlTextTags(min = 5, max = 10) {
        const count = this.randomInt(min, max);
        let result = '';
        for (let i = 0; i < count; i++) {
            result += this.randomHtmlTextTag();
        }
        return result;
    }
}

module.exports = RandomUtils;
