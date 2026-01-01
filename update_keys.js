const fs = require('fs');
const path = require('path');

const keysPath = path.join(__dirname, 'data', 'keys.json');

try {
    const keys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
    
    keys.forEach(key => {
        // 设置时长为无限
        key.duration_hours = -1;
        
        // 如果卡密已激活或已过期，清除过期时间并确保状态为 active
        if (key.status === 'active' || key.status === 'expired') {
            key.expire_time = null;
            key.status = 'active'; // 恢复已过期的卡密
        }
    });

    fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2), 'utf8');
    console.log('Successfully updated ' + keys.length + ' keys.');
} catch (e) {
    console.error('Error updating keys:', e);
}
