const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const DATA_PATH = path.join(__dirname, 'ratings.json');

// 데이터 로드/저장 유틸리티
const getRatings = () => {
    try {
        if (fs.existsSync(DATA_PATH)) {
            return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
        }
    } catch (e) { console.error("JSON Read Error:", e); }
    return {};
};

const saveRatings = (data) => {
    try {
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    } catch (e) { console.error("JSON Write Error:", e); }
};

// 급식 & 평점 데이터 반환 API
app.get('/api/meals', async (req, res) => {
    const { atpt, code, date } = req.query;
    const neisUrl = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=${atpt}&SD_SCHUL_CODE=${code}&MLSV_YMD=${date}`;
    
    try {
        const response = await fetch(neisUrl);
        if (!response.ok) throw new Error('NEIS API 응답 에러');
        
        const neisData = await response.json();
        const ratings = getRatings();
        
        res.json({ neisData, ratings });
    } catch (error) {
        console.error("Meal Fetch Error:", error);
        res.status(500).json({ error: "급식 정보를 가져오는데 실패했습니다.", details: error.message });
    }
});

// 평점 제출 API
app.post('/api/rate', (req, res) => {
    const { mealId, score, mealDate } = req.body;
    if (!mealId || score === undefined) return res.status(400).json({ error: "잘못된 요청입니다." });

    const ratings = getRatings();
    if (!ratings[mealId]) ratings[mealId] = { sum: 0, count: 0, avg: 0 };
    
    const r = ratings[mealId];
    r.sum += score;
    r.count += 1;
    r.avg = Math.round(r.sum / r.count);

    saveRatings(ratings);
    res.json({ success: true, rating: r });
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
