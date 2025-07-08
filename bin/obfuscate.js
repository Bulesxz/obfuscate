#!/usr/bin/env node
const path = require('path');
const ObfuscationEngine = require('../lib/obfuscation-engine');

// 解析命令行参数
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        targetDir: null,
        keywordObfuscationRate: 0.4, // 默认40%概率混淆关键词本身（60%不混淆）
        enableKeywordObfuscation: true
    };

    if (args.length === 0) {
        showUsage();
        process.exit(1);
    }

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--help' || arg === '-h') {
            showUsage();
            process.exit(0);
        } else if (arg === '--keyword-rate' || arg === '-k') {
            if (i + 1 >= args.length) {
                console.error('Error: --keyword-rate requires a value');
                process.exit(1);
            }
            const rate = parseFloat(args[++i]);
            if (isNaN(rate) || rate < 0 || rate > 1) {
                console.error('Error: --keyword-rate must be a number between 0 and 1');
                process.exit(1);
            }
            options.keywordObfuscationRate = rate;
        } else if (arg === '--no-keyword') {
            options.enableKeywordObfuscation = false;
        } else if (arg.startsWith('--')) {
            console.error(`Error: Unknown option ${arg}`);
            process.exit(1);
        } else {
            if (options.targetDir) {
                console.error('Error: Multiple target directories specified');
                process.exit(1);
            }
            options.targetDir = path.resolve(arg);
        }
    }

    if (!options.targetDir) {
        console.error('Error: Target directory is required');
        showUsage();
        process.exit(1);
    }

    return options;
}

function showUsage() {
    console.log(`
Usage: obfuscate [options] <target-directory>

Options:
  -h, --help                 显示帮助信息
  -k, --keyword-rate <rate>  关键词混淆概率 (0.0-1.0，默认: 0.4)
                             0.4 表示40%概率混淆关键词本身，60%保持不变
  --no-keyword               禁用关键词混淆功能

Examples:
  obfuscate ./website                    # 使用默认设置混淆网站
  obfuscate -k 0.6 ./website           # 60%概率混淆关键词本身
  obfuscate -k 0.2 ./website           # 20%概率混淆关键词本身
  obfuscate --no-keyword ./website      # 禁用关键词混淆
`);
}

const options = parseArgs();
const engine = new ObfuscationEngine(options.targetDir, options);

engine.run().catch(err => {
    console.error('Obfuscation failed:', err);
    process.exit(1);
});