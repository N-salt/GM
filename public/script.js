let currentSchool = { atpt: "", code: "", name: "" };
let favorites = JSON.parse(localStorage.getItem("fav_schools") || "[]");
let ratedMeals = JSON.parse(localStorage.getItem("rated_meals") || "[]");

const majorAllergies = {
  2: ["유당", "tag-milk"],
  3: ["메밀", "tag-nut"],
  4: ["땅콩", "tag-nut"],
  5: ["대두", "tag-soy"],
  6: ["밀", "tag-wheat"],
  14: ["호두", "tag-nut"],
  19: ["잣", "tag-nut"],
};

// [추가] 점수에 따른 한 줄 평 로직
function getComment(score) {
  if (score >= 90) return "갓벽한 급식! 오늘 학교 오길 잘했다 😍";
  if (score >= 70) return "이 정도면 훌륭하죠. 잔반 제로 도전! 😋";
  if (score >= 50) return "무난무난한 급식이에요. 평범합니다. 🙂";
  if (score >= 30) return "음.. 조금 아쉬운데요? 다음엔 맛있길.. 😕";
  return "이건 좀 선 넘었죠.. 매점 가고 싶다 😭";
}

window.onload = () => {
  document.getElementById("meal-date").value = new Date()
    .toISOString()
    .substring(0, 10);
  renderFavorites();
};

// 1. 학교 검색
async function searchSchool() {
  const keyword = document.getElementById("school-input").value.trim();
  if (!keyword) return;

  const listEl = document.getElementById("school-list");
  listEl.innerHTML = '<div class="loading">찾는 중...</div>';
  document.getElementById("favorites-section").style.display = "none";

  try {
    const res = await fetch(
      `https://open.neis.go.kr/hub/schoolInfo?Type=json&SCHUL_NM=${encodeURIComponent(
        keyword
      )}`
    );
    const data = await res.json();
    listEl.innerHTML = "";

    if (data.schoolInfo) {
      data.schoolInfo[1].row.forEach((school) => {
        const isFav = favorites.some((f) => f.code === school.SD_SCHUL_CODE);
        const li = document.createElement("li");
        li.className = "school-item";
        li.innerHTML = `
                    <div class="school-info" onclick="selectSchool('${
                      school.ATPT_OFCDC_SC_CODE
                    }', '${school.SD_SCHUL_CODE}', '${school.SCHUL_NM}')">
                        <div style="font-weight:bold">${school.SCHUL_NM}</div>
                        <div style="font-size:12px; color:var(--text-sub); margin-top:4px;">${
                          school.ORG_RDNMA
                        }</div>
                    </div>
                    <button class="fav-toggle ${
                      isFav ? "active" : ""
                    }" onclick="toggleFavorite(event, '${
          school.ATPT_OFCDC_SC_CODE
        }', '${school.SD_SCHUL_CODE}', '${school.SCHUL_NM}')">
                        ★
                    </button>
                `;
        listEl.appendChild(li);
      });
    } else {
      listEl.innerHTML = '<div class="loading">검색 결과가 없어요.</div>';
      renderFavorites();
    }
  } catch (e) {
    listEl.innerHTML = '<div class="loading">오류가 발생했습니다.</div>';
    renderFavorites();
  }
}

// 2. 즐겨찾기 토글
window.toggleFavorite = function (e, atpt, code, name) {
  e.stopPropagation();
  const index = favorites.findIndex((f) => f.code === code);
  if (index > -1) {
    favorites.splice(index, 1);
    // 화면 내의 모든 해당 학교 별표 업데이트
    document.querySelectorAll(".fav-toggle").forEach(btn => btn.classList.remove("active"));
  } else {
    favorites.push({ atpt, code, name });
    document.querySelectorAll(".fav-toggle").forEach(btn => btn.classList.add("active"));
  }
  localStorage.setItem("fav_schools", JSON.stringify(favorites));
  renderFavorites();
};

// 3. 즐겨찾기 렌더링
function renderFavorites() {
  const section = document.getElementById("favorites-section");
  const list = document.getElementById("fav-list");
  list.innerHTML = "";

  if (favorites.length > 0) {
    section.style.display = "block";
    favorites.forEach((school) => {
      const card = document.createElement("div");
      card.className = "fav-card";
      card.innerHTML = `<div class="fav-name">${school.name}</div>`;
      card.onclick = () => selectSchool(school.atpt, school.code, school.name);
      list.appendChild(card);
    });
  } else {
    section.style.display = "none";
  }
}

// 4. 학교 선택 후 화면 전환
window.selectSchool = function (atpt, code, name) {
  currentSchool = { atpt, code, name };
  document.getElementById("search-area").classList.add("active");
  document.getElementById("school-list").innerHTML = "";
  document.getElementById("school-input").value = name;
  document.getElementById("favorites-section").style.display = "none";

  document.getElementById("header-nav").classList.add("active");
  
  // [수정] 상단 바 학교명 옆에 즐겨찾기 별표 추가
  const isFav = favorites.some((f) => f.code === code);
  document.getElementById("current-school-display").innerHTML = `
    ${name} <span id="header-fav" class="fav-toggle ${isFav ? 'active' : ''}" style="cursor:pointer; margin-left:5px;">★</span>
  `;
  
  document.getElementById("header-fav").onclick = (e) => toggleFavorite(e, atpt, code, name);
  document.getElementById("meal-section").style.display = "block";

  fetchMeals();
};

// 5. 급식 정보 및 평점 서버에서 조회
async function fetchMeals() {
  const date = document.getElementById("meal-date").value.replace(/-/g, "");
  const container = document.getElementById("meal-container");
  container.innerHTML = '<div class="loading">식단표를 가져오는 중...</div>';

  try {
    const res = await fetch(
      `/api/meals?atpt=${currentSchool.atpt}&code=${currentSchool.code}&date=${date}`
    );
    const { neisData, ratings } = await res.json();

    container.innerHTML = "";

    if (neisData.mealServiceDietInfo) {
      neisData.mealServiceDietInfo[1].row.forEach((meal) => {
        const mealId = `${meal.SD_SCHUL_CODE}_${meal.MLSV_YMD}_${meal.MMEAL_SC_CODE}`;
        const rating = ratings[mealId] || { avg: 50, count: 0 }; // 기본값 50
        const hasRated = ratedMeals.includes(mealId);

        const card = document.createElement("div");
        card.className = "meal-card";

        const menuRows = meal.DDISH_NM.split("<br/>");
        let menuHtml = "";

        menuRows.forEach((row) => {
          const allergyMatch = row.match(/\(([^)]+)\)/);
          let tagsHtml = "";
          if (allergyMatch) {
            const numbers = allergyMatch[1].split(".");
            numbers.forEach((num) => {
              if (majorAllergies[num]) {
                tagsHtml += `<span class="tag ${majorAllergies[num][1]}">${majorAllergies[num][0]}</span>`;
              }
            });
          }
          const cleanName = row.replace(/\([^)]*\)/g, "").trim();
          if (cleanName) {
            menuHtml += `
                            <div class="menu-row">
                                <span class="menu-name">${cleanName}</span>
                                <div class="allergy-tags">${tagsHtml}</div>
                            </div>`;
          }
        });

        const nutrition = meal.NTR_INFO.replace(/<br\/>/g, "<br>");

        card.innerHTML = `
                    <div class="meal-header" onclick="this.parentElement.classList.toggle('open')">
                        <span class="meal-type">${meal.MMEAL_SC_NM}</span>
                        <div style="text-align: right;">
                            <span style="font-size:11px; color:var(--text-sub)">평점 ${rating.avg}% (${rating.count}명)</span><br>
                            <span style="font-size:12px; color:var(--accent)">정보/평가 ▾</span>
                        </div>
                    </div>
                    <div class="meal-content">
                        <div class="menu-list-container">${menuHtml}</div>
                        
                        <div class="rate-box">
                            <b style="color:var(--accent)">[급식 평가하기]</b><br>
                            ${
                              hasRated
                                ? `
                                <div class="done-text">평가 완료 ✅</div>
                                <div style="text-align:center; font-size:13px; color:var(--text-sub); margin-top:5px;">
                                    "${getComment(rating.avg)}"
                                </div>`
                                : `
                                <div style="display:flex; justify-content:space-between; margin-top:8px;">
                                    <span>만족도: <b id="val-${mealId}">50%</b></span>
                                    <span id="comm-${mealId}" style="font-size:11px; color:var(--accent)">${getComment(50)}</span>
                                </div>
                                <input type="range" id="range-${mealId}" min="0" max="100" step="10" value="50"
                                    oninput="
                                        document.getElementById('val-${mealId}').innerText = this.value + '%';
                                        document.getElementById('comm-${mealId}').innerText = getComment(this.value);
                                    ">
                                <button class="submit-btn" onclick="submitRating('${mealId}', '${meal.MLSV_YMD}')">평가 제출하기</button>
                            `
                            }
                        </div>

                        <div class="nutrition-box">
                            <b style="color:var(--accent)">[영양 및 칼로리]</b><br>
                            <div style="margin-top:8px; line-height:1.6; font-size: 13px;">
                                총 열량: ${meal.CAL_INFO}<br><br>
                                ${nutrition}
                            </div>
                        </div>
                    </div>
                `;
        container.appendChild(card);
      });
    } else {
      container.innerHTML =
        '<div class="loading">급식 정보가 없거나 주말입니다. 😴</div>';
    }
  } catch (e) {
    container.innerHTML =
      '<div class="loading">데이터를 불러오지 못했습니다. 서버 상태를 확인해주세요.</div>';
  }
}

// 6. 평점 제출 통신 로직
window.submitRating = async function (mealId, mealDate) {
  const score = parseInt(document.getElementById(`range-${mealId}`).value);

  try {
    const res = await fetch("/api/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealId, score, mealDate }),
    });

    if (res.ok) {
      ratedMeals.push(mealId);
      localStorage.setItem("rated_meals", JSON.stringify(ratedMeals));
      alert("평가가 제출되었습니다!");
      fetchMeals(); 
    } else {
      const err = await res.json();
      alert(err.error || "제출에 실패했습니다.");
    }
  } catch (e) {
    alert("서버와 통신할 수 없습니다.");
  }
};

// 이벤트 리스너
document.getElementById("btn-home").onclick = () => location.reload();
document.getElementById("school-input").onkeypress = (e) => {
  if (e.key === "Enter") searchSchool();
};
document.getElementById("btn-search").onclick = searchSchool;
document.getElementById("meal-date").onchange = fetchMeals;
