// scripts/update-version.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 获取当前 commit 短哈希
function getCommitHash() {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch (e) {
        console.error('获取 Git Commit 失败:', e.message);
        process.exit(1);
    }
}

// 更新 version.json 版本
function updateVersion() {
    const commitHash = getCommitHash();
    const versionPath = path.resolve(__dirname, '../public/version.json');

    try {
        const pkg = require(versionPath);
        // 在原始版本号后追加 commit hash
        pkg.version = `${pkg.version}-${commitHash}`;

        // 写回文件
        fs.writeFileSync(versionPath, JSON.stringify(pkg, null, 2) + '\n');
        console.log(`✅ 版本号已更新为: ${pkg.version}`);

        // 重新暂存修改后的 version.json
        execSync('git add public/version.json');
    } catch (e) {
        console.error('更新 version.json 失败:', e.message);
        process.exit(1);
    }
}

updateVersion();