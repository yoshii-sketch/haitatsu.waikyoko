let lastLat = null;
let lastLng = null;
let lastUpdateTime = null;

let updateCount = 0;
let stopTime = 0;

// GPS監視開始
navigator.geolocation.watchPosition(

    function (position) {

        updateCount++;

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        const now = Date.now();

        // 基本情報表示
        document.getElementById("lat").textContent =
            "緯度：" + lat;

        document.getElementById("lng").textContent =
            "経度：" + lng;

        document.getElementById("accuracy").textContent =
            "精度：" + accuracy.toFixed(1) + "m";

        document.getElementById("count").textContent =
            "更新回数：" + updateCount;

        document.getElementById("time").textContent =
            "更新時刻：" +
            new Date().toLocaleTimeString();

        // 2回目以降
        if (
            lastLat !== null &&
            lastLng !== null &&
            lastUpdateTime !== null
        ) {

            const distance = getDistance(
                lastLat,
                lastLng,
                lat,
                lng
            );

            document.getElementById("distance").textContent =
                "移動距離：" +
                distance.toFixed(2) +
                "m";

            const elapsedSeconds =
                (now - lastUpdateTime) / 1000;

            // GPS精度ベースの閾値
            const stopThreshold =
                Math.max(6, accuracy);

            document.getElementById("debug").textContent =
                "判定距離：" +
                distance.toFixed(2) +
                "m / 閾値：" +
                stopThreshold.toFixed(2) +
                "m";

            // 停止判定
            if (distance < stopThreshold) {

                stopTime += elapsedSeconds;

                document.getElementById("stopTime").textContent =
                    "停止時間：" +
                    stopTime.toFixed(1) +
                    "秒";

                if (stopTime >= 3) {

                    document.getElementById("status").textContent =
                        "状態：停止中";

                } else {

                    document.getElementById("status").textContent =
                        "状態：停止判定中";
                }

            } else {

                stopTime = 0;

                document.getElementById("stopTime").textContent =
                    "停止時間：0秒";

                document.getElementById("status").textContent =
                    "状態：移動中";
            }
        }

        lastLat = lat;
        lastLng = lng;
        lastUpdateTime = now;

    },

    function (error) {

        console.error(error);

        document.getElementById("status").textContent =
            "エラー：" + error.message;
    },

    {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
    }

);


// 2地点間距離(m)
function getDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371000;

    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;

    const dLon =
        (lon2 - lon1) *
        Math.PI / 180;

    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *

        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}
