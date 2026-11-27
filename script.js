let map = null;
let currentMarker = null;

let routePoints = [];
let routeLine = null;

let stopMarkers = [];

let lastLat = null;
let lastLng = null;
let lastUpdateTime = null;

let updateCount = 0;
let stopTime = 0;

let tracking = false;
let currentlyStopped = false;


// =====================
// 配達開始
// =====================

document
.getElementById("startBtn")
.addEventListener(
    "click",
    () => {

        tracking = true;

        stopTime = 0;

        currentlyStopped = false;

        document.getElementById(
            "recordStatus"
        ).textContent =
        "記録状態：記録中";
    }
);


// =====================
// 配達終了
// =====================

document
.getElementById("stopBtn")
.addEventListener(
    "click",
    () => {

        tracking = false;

        stopTime = 0;

        currentlyStopped = false;

        document.getElementById(
            "recordStatus"
        ).textContent =
        "記録状態：停止中";
    }
);


// =====================
// 履歴消去
// =====================

document
.getElementById("clearBtn")
.addEventListener(
    "click",
    () => {

        // 青線削除
        if (routeLine) {

            map.removeLayer(
                routeLine
            );

            routeLine = null;
        }

        // ルート履歴削除
        routePoints = [];

        // 赤丸削除
        stopMarkers.forEach(
            marker => {

                map.removeLayer(
                    marker
                );
            }
        );

        stopMarkers = [];

        stopTime = 0;

        currentlyStopped = false;

        document.getElementById(
            "stopTime"
        ).textContent =
        "停止時間：0秒";

        document.getElementById(
            "status"
        ).textContent =
        "状態：移動中";

        document.getElementById(
            "debug"
        ).textContent =
        "判定：";

        document.getElementById(
            "distance"
        ).textContent =
        "移動距離：";

    }
);


// =====================
// GPS監視
// =====================

navigator.geolocation.watchPosition(

    function(position) {

        const lat =
            position.coords.latitude;

        const lng =
            position.coords.longitude;

        const accuracy =
            position.coords.accuracy;

        const now =
            Date.now();

        updateCount++;

        // -----------------
        // 地図作成
        // -----------------

        if (!map) {

            map = L.map(
                "map"
            ).setView(
                [lat, lng],
                18
            );

            L.tileLayer(
                "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    maxZoom: 19,
                    attribution:
                    "&copy; OpenStreetMap contributors"
                }
            ).addTo(map);
        }

        // -----------------
        // 現在地マーカー
        // -----------------

        if (currentMarker) {

            currentMarker.setLatLng(
                [lat, lng]
            );

        } else {

            currentMarker =
                L.marker(
                    [lat, lng]
                ).addTo(map);
        }

        map.panTo(
            [lat, lng]
        );

        // -----------------
        // 画面表示
        // -----------------

        document.getElementById(
            "lat"
        ).textContent =
        "緯度：" + lat;

        document.getElementById(
            "lng"
        ).textContent =
        "経度：" + lng;

        document.getElementById(
            "accuracy"
        ).textContent =
        "精度：" +
        accuracy.toFixed(1) +
        "m";

        document.getElementById(
            "count"
        ).textContent =
        "更新回数：" +
        updateCount;

        document.getElementById(
            "time"
        ).textContent =
        "更新時刻：" +
        new Date()
            .toLocaleTimeString();

        // -----------------
        // 記録中のみ
        // -----------------

        if (tracking) {

            routePoints.push(
                [lat, lng]
            );

            if (routeLine) {

                routeLine.setLatLngs(
                    routePoints
                );

            } else {

                routeLine =
                L.polyline(
                    routePoints,
                    {
                        color:
                        "blue",

                        weight:
                        4
                    }
                ).addTo(map);
            }

        }

        // -----------------
        // 停止判定
        // -----------------

        if (

            tracking &&

            lastLat !== null &&

            lastLng !== null &&

            lastUpdateTime !== null

        ) {

            const distance =
                getDistance(

                    lastLat,

                    lastLng,

                    lat,

                    lng
                );

            document.getElementById(
                "distance"
            ).textContent =
            "移動距離：" +
            distance.toFixed(2) +
            "m";

            const elapsedSeconds =
                (
                    now -
                    lastUpdateTime
                ) / 1000;

            const stopThreshold =
                Math.max(
                    6,
                    accuracy
                );

            document.getElementById(
                "debug"
            ).textContent =

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

                    if (
                        !currentlyStopped
                    ) {

                        currentlyStopped = true;

                        const stopMarker =

                            L.circleMarker(
                                [lat, lng],
                                {
                                    radius: 8,

                                    color:
                                        "red",

                                    fillColor:
                                        "red",

                                    fillOpacity:
                                        0.8
                                }
                            )
                            .addTo(map);

                        stopMarkers.push(
                            stopMarker
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

                currentlyStopped = false;

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

    function(error) {

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


// =====================
// 2点間距離計算
// =====================

function getDistance(

    lat1,
    lon1,

    lat2,
    lon2

) {

    const R = 6371000;

    const dLat =

        (lat2 - lat1)
        *
        Math.PI
        /
        180;

    const dLon =

        (lon2 - lon1)
        *
        Math.PI
        /
        180;

    const a =

        Math.sin(
            dLat / 2
        )

        *

        Math.sin(
            dLat / 2
        )

        +

        Math.cos(
            lat1 *
            Math.PI /
            180
        )

        *

        Math.cos(
            lat2 *
            Math.PI /
            180
        )

        *

        Math.sin(
            dLon / 2
        )

        *

        Math.sin(
            dLon / 2
        );

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
