let lastLat = null;
let lastLng = null;
let updateCount = 0;

navigator.geolocation.watchPosition(
    function (position) {

        updateCount++;

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        document.getElementById("lat").textContent =
            "緯度：" + lat;

        document.getElementById("lng").textContent =
            "経度：" + lng;

        document.getElementById("accuracy").textContent =
            "精度：" + accuracy.toFixed(1) + "m";

        document.getElementById("count").textContent =
            "更新回数：" + updateCount;

        if (lastLat !== null && lastLng !== null) {

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

            console.log(
                "更新",
                updateCount,
                "距離",
                distance.toFixed(2)
            );
        }

        lastLat = lat;
        lastLng = lng;
    },

    function (error) {
        console.error(error);

        alert(
            "位置情報エラー\n" +
            error.message
        );
    },

    {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
    }
);


function getDistance(lat1, lon1, lat2, lon2) {

    const R = 6371000;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

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