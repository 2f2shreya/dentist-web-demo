const fs = require('fs');
const path = require('path');

function removeComments(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath);

    if (ext === '.js') {
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
        content = content.replace(/(?:^|\s)\/\/.*$/gm, '');
    } else if (ext === '.css') {
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    } else if (ext === '.html' || ext === '.xml') {
        content = content.replace(/<!--[\s\S]*?-->/g, '');
    }

    fs.writeFileSync(filePath, content, 'utf8');
}

function traverse(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverse(fullPath);
        } else {
            const ext = path.extname(fullPath);
            if (['.js', '.css', '.html'].includes(ext)) {
                try {
                    removeComments(fullPath);
                } catch (e) {
                    // Ignore errors on protected files
                }
            }
        }
    }
}

const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
    traverse(nodeModulesPath);
    console.log('Successfully stripped all comments from node_modules');
} else {
    console.log('node_modules directory not found');
}
