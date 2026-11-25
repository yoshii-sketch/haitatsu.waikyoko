let map = null;
let currentMarker = null;

let routePoints = [];
let routeLine = null;

let lastLat = null;
let lastLng = null;
let lastUpdateTime = null;

let updateCount = 0;
let stopTime = 0;
let currentlyStopped = false;


// GPS監視開始
navigator.geolocation.watchPosition(

    function (position) {

        updateCount++;

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        const now = Date.now();

        // --------------------
        // 地図の初期化
        // --------------------
        if (!map) {

            map = L.map("map").setView(
                [lat, lng],
                18
            );

            L.tileLayer(
                "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    maxZoom: 19
                }
            ).addTo(map);
        }

        // --------------------
        // 現在位置マーカー
        // --------------------
        if (currentMarker) {

            currentMarker.setLatLng(
                [lat, lng]
            );

        } else {

            currentMarker = L.marker(
                [lat, lng]
            ).addTo(map);

        }

        // --------------------
        // 地図追従
        // --------------------
        map.panTo([lat, lng]);

        // --------------------
        // ルート記録
        // --------------------
        routePoints.push([lat, lng]);

        if (routeLine) {

            routeLine.setLatLngs(
                routePoints
            );

        } else {

            routeLine = L.polyline(
                routePoints,
                {
                    color: "blue",
                    weight: 4
                }
            ).addTo(map);

        }

        // --------------------
        // 画面表示
        // --------------------
        document.getElementById("lat").textContent =
            "緯度：" + lat;

        document.getElementById("lng").textContent =
            "経度：" + lng;

        document.getElementById("accuracy").textContent =
            "精度：" +
            accuracy.toFixed(1) +
            "m";

        document.getElementById("count").textContent =
            "更新回数：" +
            updateCount;

        document.getElementById("time").textContent =
            "更新時刻：" +
            new Date().toLocaleTimeString();

        // --------------------
        // 停止判定
        // --------------------
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

            const stopThreshold =
                Math.max(
                    6,
                    accuracy
                );

            document.getElementById("debug").textContent =
                "距離：" +
                distance.toFixed(2) +
                "m / 閾値：" +
                stopThreshold.toFixed(2) +
                "m";

            if (
                distance <
                stopThreshold
            ) {

                stopTime +=
                    elapsedSeconds;

                document.getElementById(
                    "stopTime"
                ).textContent =
                    "停止時間：" +
                    stopTime.toFixed(1) +
                    "秒";

                if (
                    stopTime >= 3
                ) {

                    document.getElementById(
                        "status"
                    ).textContent =
                        "状態：停止中";

                    // 停止地点を1回だけ記録
                    if (
                        !currentlyStopped
                    ) {

                        currentlyStopped =
                            true;

                        L.circleMarker(
                            [lat, lng],
                            {
                                radius: 8,
                                color: "red",
                                fillColor:
                                    "red",
                                fillOpacity:
                                    0.8
                            }
                        ).addTo(map);

                        console.log(
                            "停止地点記録",
                            lat,
                            lng
                        );
                    }

                } else {

                    document.getElementById(
                        "status"
                    ).textContent =
                        "状態：停止判定中";
                }

            } else {

                stopTime = 0;

                currentlyStopped =
                    false;

                document.getElementById(
                    "stopTime"
                ).textContent =
                    "停止時間：0秒";

                document.getElementById(
                    "status"
                ).textContent =
                    "状態：移動中";
            }
        }

        lastLat = lat;
        lastLng = lng;
        lastUpdateTime = now;

    },

    function (error) {

        console.error(error);

        document.getElementById(
            "status"
        ).textContent =
            "エラー：" +
            error.message;
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

        Math.cos(
            lat1 *
            Math.PI /
            180
        ) *

        Math.cos(
            lat2 *
            Math.PI /
            180
        ) *

        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(
                1 - a
            )
        );

    return R * c;
}
