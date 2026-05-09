const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const DATA_PATH = './ratings.json';
const getRatings = () => fs.existsSync(DATA_PATH) ? JSON.parse(fs.readFileSync(DATA_PATH)) : {};
const saveRatings = (data) => fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

// 급식 & 평점 데이터 동시 반환
app.get('/api/meals', async (req, res) => {
    const { atpt, code, date } = req.query;
    const neisRes = await fetch(`https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=${atpt}&SD_SCHUL_CODE=${code}&MLSV_YMD=${date}`);
    const neisData = await neisRes.json();
    res.json({ neisData, ratings: getRatings() });
});

// 평점 제출 로직 (핵심: 서버에서 미리 계산해서 저장)
app.post('/api/rate', (req, res) => {
    const { mealId, score, mealDate } = req.body;

    // 1. 기간 체크 (+/- 3일)
    const today = new Date(); today.setHours(0,0,0,0);
    const mDate = new Date(mealDate.substring(0,4), mealDate.substring(4,6)-1, mealDate.substring(6,8));
    const diffDays = Math.abs(today - mDate) / (1000 * 60 * 60 * 24);
    
    if (diffDays > 3) return res.status(403).json({ error: "평가 가능 기간이 아닙니다 (앞뒤 3일만 가능)" });

    // 2. 평균 미리 계산 로직 (데이터베이스 부하 방지)
    const ratings = getRatings();
    if (!ratings[mealId]) ratings[mealId] = { sum: 0, count: 0, avg: 0 };
    
    const r = ratings[mealId];
    r.sum += score;
    r.count += 1;
    r.avg = Math.round(r.sum / r.count); // 소수점 반올림

    saveRatings(ratings);
    res.json({ success: true });
});

app.listen(3000, () => console.log('Server is running on port 3000'));