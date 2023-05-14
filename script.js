const apiKey = 'AIzaSyCUwSwVgXWizTDw5NQqWE-gpfvFiefqAhA';
const translateUrl = 'https://translation.googleapis.com/language/translate/v2';
let angle = 0;

const currentTime = document.getElementById('current-time');
const weather = document.getElementById('weather');

const weatherApiKey = 'f1ec525eaf1a858e2d671cd2de2e909a';
const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=33.995319&lon=-117.930842&appid=${weatherApiKey}&units=metric`;

async function getWeather() {
  try {
    const response = await axios.get(weatherUrl);
    const temperature = response.data.main.temp;
    weather.textContent = `当前温度: ${temperature}°C`;
    if (temperature < 15) {
      weather.textContent += ' 记得穿衣保暖';
    } else if (temperature > 25) {
      weather.textContent += ' 温度较高，请注意防晒和降温';
    }
  } catch (error) {
    console.error('Error getting weather:', error);
  }
}

function updateTime() {
  const now = new Date();
  currentTime.textContent = `当前时间: ${now.toLocaleTimeString()}`;
}

async function init() {
  drawWheel(); // Draw the wheel immediately
  await initMap();
  getWeather();
  updateTime();
  // 显示弹窗
  const customAlert = document.getElementById('custom-alert');
  customAlert.style.display = 'block';

  // 2秒后自动关闭弹窗
  setTimeout(() => {
    customAlert.style.display = 'none';
  }, 1000);
}

// 更新时间每秒钟
setInterval(updateTime, 1000);



window.init = init;
window.initMap = initMap;

async function translateText(text) {
  try {
    const response = await axios.post(translateUrl, null, {
      params: {
        q: text,
        source: 'en',
        target: 'zh-CN',
        key: apiKey
      }
    });
    return response.data.data.translations[0].translatedText;
  } catch (error) {
    console.error('Error translating text:', error);
    return text;
  }
}


const sentiment = {
  positive: ['好', '棒', '美味', '喜欢', '友好', '推荐', '满意', '新鲜', '干净', '舒适'],
  negative: ['差', '糟糕', '失望', '慢', '差劲', '贵', '不好', '难吃', '脏']
};

function analyzeSentiment(text) {
  let score = 0;
  sentiment.positive.forEach(word => {
    if (new RegExp('\\b' + word + '\\b', 'gi').test(text)) score++;
  });
  sentiment.negative.forEach(word => {
    if (new RegExp('\\b' + word + '\\b', 'gi').test(text)) score--;
  });
  return score;
}


const defaultCategories = [
  '火锅', '披萨', '汉堡', '土豆粉', '越南粉', '中式快餐', '川菜',
  '美式早餐', '奶茶', '炸鸡', '沙拉', '豆腐汤', '烧烤', '海鲜', '牛排', '牛蛙', '烧菜'
];

let categories = [...defaultCategories].map(category => ({ name: category, keywords: [category] }));


const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spin-btn');

const restaurantName = document.getElementById('restaurant-name');
const restaurantDistance = document.getElementById('restaurant-distance');
const restaurantAddress = document.getElementById('restaurant-address');
const restaurantRating = document.getElementById('restaurant-rating');  // newly added line


let restaurants = [];

async function initMap() {
  const map = new google.maps.Map(document.createElement('div'));
  const service = new google.maps.places.PlacesService(map);

  const request = {
  location: new google.maps.LatLng(33.995319, -117.930842),
  rankBy: google.maps.places.RankBy.DISTANCE, // 按距离排序搜索结果
  type: 'restaurant'
};


service.nearbySearch(request, async (results, status) => {
  if (status === google.maps.places.PlacesServiceStatus.OK) {
    restaurants = results.filter(restaurant => restaurant.types.indexOf('bar') === -1);
    console.log('Calling createCategories...');
    createCategories();
    console.log('Calling categorizeRestaurants...');
    categorizeRestaurants();
  }
});

}
async function createCategories() {
  categories = []; // 请确保清空categories数组
  for (const category of defaultCategories) {
    const translatedKeywords = await translateText(category);
    categories.push({ name: category, keywords: [category].concat(translatedKeywords) });
  }
}

function levenshteinDistance(a, b) {
  const matrix = [];

  let i;
  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  let j;
  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}


async function categorizeRestaurants() {
  const threshold = 5; 
  for (const restaurant of restaurants) {
    restaurant.category = '';
  
    // 将餐厅名称翻译成中文
    const translatedName = await translateText(restaurant.name);
    restaurant.translatedName = translatedName;
        console.log(`Restaurant Name: ${restaurant.translatedName}`);
   	 console.log(`Restaurant Category: ${restaurant.category}`);
    const details = await getRestaurantDetails(restaurant.place_id);
    if (details.reviews) {
      restaurant.reviews = details.reviews;
    }

    // 分析餐厅名称
   
const restaurantNameWords = restaurant.translatedName.split(/\s+/);

for (const category of categories) {
  for (const keyword of category.keywords) {
    // 计算关键词和餐厅名称之间的 Levenshtein 距离
    const distance = levenshteinDistance(keyword, restaurant.translatedName);

    // 如果距离在某个阈值以下，则认为找到了匹配的关键词
    if (distance < threshold && !restaurant.category) {
      restaurant.category = category.name;
      break;
    }
  }
  if (restaurant.category) {
    break;
  }
}


    // 如果名称中未找到关键字，尝试从评论中查找
    if (!restaurant.category && restaurant.reviews) {
      let categoryFrequency = {};
      for (const review of restaurant.reviews) {
        const translatedText = await translateText(review.text);
        const score = analyzeSentiment(translatedText);

        categories.forEach(category => {
          category.keywords.forEach(keyword => {
            if (new RegExp(`\\b${keyword}\\b`, 'i').test(translatedText) && score > 0) {
              if (categoryFrequency.hasOwnProperty(category.name)) {
                categoryFrequency[category.name]++;
              } else {
                categoryFrequency[category.name] = 1;
              }
	 
            }
          });
        });
      }

      let maxFrequency = 0;
      for (const category of categories) {
        if (categoryFrequency.hasOwnProperty(category.name) && categoryFrequency[category.name] > maxFrequency) {
          restaurant.category = category.name;
          maxFrequency = categoryFrequency[category.name];
        }
      }

      if (!restaurant.category) {
        restaurant.category = '其他';
      }
    }
  }


}

async function getRestaurantDetails(placeId) {
  return new Promise((resolve, reject) => {
    const map = new google.maps.Map(document.createElement('div'));
    const service = new google.maps.places.PlacesService(map);

    const request = {
      placeId: placeId,
      fields: ['reviews']
    };

    service.getDetails(request, (result, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        resolve(result);
      } else {
        reject(status);
      }
    });
  });
}


function drawWheel() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the categories
  const anglePerCategory = 2 * Math.PI / categories.length;
  for (let i = 0; i < categories.length; i++) {
    const startAngle = i * anglePerCategory + angle;
    const endAngle = (i + 1) * anglePerCategory + angle;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();

    const colors = ['#FFD700', '#FFA500', '#FF8C00', '#FF7F50', '#FF6347'];  



    ctx.fillStyle = colors[i % colors.length];

    ctx.fill();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(startAngle + anglePerCategory / 2);
    ctx.fillStyle = 'black';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(categories[i].name, radius - 10, 0);
    ctx.restore();
  }

  
  // Draw the pointer statically at the top

ctx.save();
ctx.translate(centerX, centerY);
ctx.rotate(0);  // rotate the pointer to the top
ctx.beginPath();
ctx.strokeStyle = 'red';
ctx.lineWidth = 3;
ctx.moveTo(0, 0);
ctx.lineTo(0, -radius + 20);
ctx.stroke();
ctx.restore();


}
// 旋转转盘
async function rotateWheel() {
  const anglePerCategory = 2 * Math.PI / categories.length;
  const spinCount = 3 + Math.floor(Math.random() * 3);  // random number of spins
  const endAngle = spinCount * 2 * Math.PI + Math.floor(Math.random() * categories.length) * anglePerCategory;  // add random category
  const duration = 3000;  // animation duration in ms

  return new Promise((resolve) => {
    const startAngle = angle;
    const startTime = performance.now();

    function animate(currentTime) {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);

      angle = startAngle + (endAngle - startAngle) * progress;
      drawWheel();

      if (progress < 1) {
        window.requestAnimationFrame(animate);
      } else {
        angle %= 2 * Math.PI;
        if (angle < 0) angle += 2 * Math.PI;  // 确保角度在0到2 * Math.PI之间
        const categoryIndex = Math.floor((2 * Math.PI - angle + anglePerCategory / 2) / anglePerCategory) % categories.length;
        resolve(categoryIndex);
      }
    }

    window.requestAnimationFrame(animate);
  });
}

// 修改这里
function getEnglishCategory(chineseCategory) {
  const category = categories.find(category => category.name === chineseCategory);
  if (category) {
    return category.name;  // return the original category name
  } else {
    return chineseCategory;
  }
}



async function displayRestaurant(selectedCategory) {
  console.log('Category received in displayRestaurant:', selectedCategory);

  const matchingRestaurants = restaurants.filter(restaurant => restaurant.category === selectedCategory);
  console.log('Restaurants to display:', matchingRestaurants);

  document.getElementById('result').style.display = 'block';

  if (matchingRestaurants.length === 0) {
    restaurantName.textContent = '很抱歉，没有找到相关餐厅';
    restaurantAddress.textContent = '';
    restaurantDistance.textContent = '';
    restaurantRating.textContent = '';  // clear rating
    return;
  }

  // 随机选择一个餐厅并将其移至数组开头
  const randomIndex = Math.floor(Math.random() * matchingRestaurants.length);
  const chosenRestaurant = matchingRestaurants.splice(randomIndex, 1)[0];
  matchingRestaurants.unshift(chosenRestaurant);

  // 对剩余餐厅按评分进行排序
  matchingRestaurants.sort((a, b) => b.rating - a.rating);

  const restaurantLoc = new google.maps.LatLng(chosenRestaurant.geometry.location.lat(), chosenRestaurant.geometry.location.lng());
  const userLoc = new google.maps.LatLng(33.995319, -117.930842);
  const distance = google.maps.geometry.spherical.computeDistanceBetween(userLoc, restaurantLoc) / 1000;

  restaurantName.textContent = chosenRestaurant.name;
  restaurantAddress.textContent = chosenRestaurant.vicinity;
  restaurantDistance.textContent = `距离: ${distance.toFixed(2)}公里`;
  restaurantRating.textContent = `推荐指数: ${chosenRestaurant.rating}颗星`;  // newly added line
}

spinBtn.addEventListener('click', async () => {
  const endAngle = angle + (3 + Math.random() * 7) * 2 * Math.PI;
  const duration = 3000 + Math.random() * 2000;

  const categoryIndex = await rotateWheel(endAngle, duration);
  displayRestaurant(categories[categoryIndex].name);
});

