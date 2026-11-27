"use strict";

// ========================================
// 設定
// ========================================

const STORAGE_KEY = "deliveryTrackerHouses";

// 停止と判定する秒数
const STOP_SECONDS = 3;

// 停止判定距離の下限
const MIN_STOP_THRESHOLD_METERS = 6;

// GPS精度が悪いときに判定範囲が
// 無制限に広がらないようにする上限
const MAX_STOP_THRESHOLD_METERS = 20;

// 初期地図位置
// GPS取得後、自動的に現在地へ移動する
const DEFAULT_MAP_CENTER = [36.2048, 138.2529];
const DEFAULT_MAP_ZOOM = 5;


// ========================================
// Leaflet関連
// ========================================

let map = null;
let currentMarker = null;
let accuracyCircle = null;

let routeLine = null;
let routePoints = [];

let stopMarkers = [];
let houseMarkers = new Map();

let temporaryMarker = null;


// ========================================
// GPS・記録状態
// ========================================

let tracking = false;
let hasCenteredOnCurrentLocation = false;

let updateCount = 0;

let lastLat = null;
let lastLng = null;
let lastUpdateTime = null;

let stopTime = 0;
let currentlyStopped = false;


// ========================================
// 配達先登録状態
// ========================================

let houses = loadHouses();

let searchCandidates = [];

let selectedLat = null;
let selectedLng = null;

let selectedPositionSource = null;


// ========================================
// HTML要素
// ========================================

const startBtn =
    document.getElementById("startBtn");

const stopBtn =
    document.getElementById("stopBtn");

const clearBtn =
    document.getElementById("clearBtn");

const recordStatus =
    document.getElementById("recordStatus");

const houseNameInput =
    document.getElementById("houseName");

const houseAddressInput =
    document.getElementById("houseAddress");

const searchAddressBtn =
    document.getElementById("searchAddressBtn");

const manualPositionBtn =
    document.getElementById("manualPositionBtn");

const registerHouseBtn =
    document.getElementById("registerHouseBtn");

const searchStatus =
    document.getElementById("searchStatus");

const candidateArea =
    document.getElementById("candidateArea");

const candidateList =
    document.getElementById("candidateList");

const selectedLatText =
    document.getElementById("selectedLat");

const selectedLngText =
    document.getElementById("selectedLng");

const houseList =
    document.getElementById("houseList");

const houseCount =
    document.getElementById("houseCount");

const emptyHouseMessage =
    document.getElementById("emptyHouseMessage");


// ========================================
// 初期化
// ========================================

initializeMap();
updateHouseList();
drawHouses();
startLocationWatch();


// ========================================
// 地図初期化
// ========================================

function initializeMap() {

    map = L.map("map").setView(
        DEFAULT_MAP_CENTER,
        DEFAULT_MAP_ZOOM
    );

    L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,

            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);

    map.on("click", event => {

        setTemporaryPosition(
            event.latlng.lat,
            event.latlng.lng,
            "manual-correction"
        );

        setSearchMessage(
            "地図上で位置を指定しました。仮ピンをドラッグして補正できます。",
            "success"
        );
    });
}


// ========================================
// localStorage
// ========================================

function loadHouses() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEY
            );

        if (!saved) {
            return [];
        }

        const parsed =
            JSON.parse(saved);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.error(
            "配達先データ読込エラー",
            error
        );

        return [];
    }
}


function saveHouses() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(houses)
    );
}


// ========================================
// 配達先一覧
// ========================================

function updateHouseList() {

    houseList.innerHTML = "";

    houseCount.textContent =
        `${houses.length}件`;

    emptyHouseMessage.style.display =
        houses.length === 0
            ? "block"
            : "none";

    houses.forEach(house => {

        const item =
            document.createElement("li");

        item.className =
            "house-item";

        const information =
            document.createElement("div");

        const name =
            document.createElement("span");

        name.className =
            "house-name";

        name.textContent =
            house.name;

        const address =
            document.createElement("span");

        address.className =
            "house-address";

        address.textContent =
            house.address ||
            "住所未入力";

        const coordinates =
            document.createElement("span");

        coordinates.className =
            "house-coordinates";

        coordinates.textContent =
            `緯度 ${house.lat.toFixed(6)} / 経度 ${house.lng.toFixed(6)}`;

        information.append(
            name,
            address,
            coordinates
        );

        const actions =
            document.createElement("div");

        actions.className =
            "house-actions";

        const showButton =
            document.createElement("button");

        showButton.type =
            "button";

        showButton.className =
            "small-button show-button";

        showButton.textContent =
            "地図表示";

        showButton.addEventListener(
            "click",
            () => showHouseOnMap(house.id)
        );

        const deleteButton =
            document.createElement("button");

        deleteButton.type =
            "button";

        deleteButton.className =
            "small-button delete-button";

        deleteButton.textContent =
            "削除";

        deleteButton.addEventListener(
            "click",
            () => deleteHouse(house.id)
        );

        actions.append(
            showButton,
            deleteButton
        );

        item.append(
            information,
            actions
        );

        houseList.appendChild(item);
    });
}


// ========================================
// 配達先ピン
// ========================================

function drawHouses() {

    houseMarkers.forEach(marker => {
        map.removeLayer(marker);
    });

    houseMarkers.clear();

    houses.forEach(house => {

        const marker =
            L.marker(
                [house.lat, house.lng]
            )
            .addTo(map);

        marker.bindPopup(
            createHousePopup(house)
        );

        houseMarkers.set(
            house.id,
            marker
        );
    });
}


function createHousePopup(house) {

    const safeName =
        escapeHtml(house.name);

    const safeAddress =
        escapeHtml(
            house.address ||
            "住所未入力"
        );

    return `
        <strong>${safeName}</strong>
        <br>
        ${safeAddress}
        <br>
        <small>
            緯度 ${house.lat.toFixed(6)}
            <br>
            経度 ${house.lng.toFixed(6)}
        </small>
    `;
}


function showHouseOnMap(houseId) {

    const house =
        houses.find(
            item => item.id === houseId
        );

    if (!house) {
        return;
    }

    map.setView(
        [house.lat, house.lng],
        19
    );

    const marker =
        houseMarkers.get(houseId);

    marker?.openPopup();
}


function deleteHouse(houseId) {

    const house =
        houses.find(
            item => item.id === houseId
        );

    if (!house) {
        return;
    }

    const shouldDelete =
        confirm(
            `「${house.name}」を削除しますか？`
        );

    if (!shouldDelete) {
        return;
    }

    houses =
        houses.filter(
            item => item.id !== houseId
        );

    saveHouses();
    updateHouseList();
    drawHouses();

    navigator.vibrate?.(
        [80, 40, 80]
    );
}


// ========================================
// 国土地理院住所検索
// ========================================

searchAddressBtn.addEventListener(
    "click",
    searchAddress
);

houseAddressInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
            event.preventDefault();
            searchAddress();
        }
    }
);


async function searchAddress() {

    const address =
        houseAddressInput.value.trim();

    if (!address) {

        setSearchMessage(
            "住所を入力してください。",
            "error"
        );

        houseAddressInput.focus();

        return;
    }

    searchAddressBtn.disabled = true;

    searchAddressBtn.textContent =
        "検索中...";

    candidateArea.classList.remove(
        "visible"
    );

    candidateList.innerHTML = "";

    setSearchMessage(
        "国土地理院の住所検索を実行しています。",
        ""
    );

    const url =
        "https://msearch.gsi.go.jp/address-search/AddressSearch?q=" +
        encodeURIComponent(address);

    try {

        const response =
            await fetch(url);

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const data =
            await response.json();

        if (!Array.isArray(data)) {

            throw new Error(
                "検索結果の形式が正しくありません"
            );
        }

        searchCandidates =
            data.filter(
                isValidGsiCandidate
            );

        if (
            searchCandidates.length === 0
        ) {

            setSearchMessage(
                "住所候補が見つかりませんでした。住所を町名まで短くするか、「地図から指定」を使ってください。",
                "error"
            );

            return;
        }

        showSearchCandidates();

        setSearchMessage(
            `${searchCandidates.length}件の候補が見つかりました。候補を選んでください。`,
            "success"
        );

    } catch (error) {

        console.error(
            "住所検索エラー",
            error
        );

        setSearchMessage(
            `住所検索に失敗しました：${error.message}`,
            "error"
        );

    } finally {

        searchAddressBtn.disabled =
            false;

        searchAddressBtn.textContent =
            "🔍 住所を検索";
    }
}


function isValidGsiCandidate(candidate) {

    const coordinates =
        candidate?.geometry?.coordinates;

    return (
        Array.isArray(coordinates) &&
        coordinates.length >= 2 &&
        Number.isFinite(
            Number(coordinates[0])
        ) &&
        Number.isFinite(
            Number(coordinates[1])
        )
    );
}


function showSearchCandidates() {

    candidateList.innerHTML = "";

    searchCandidates.forEach(
        (candidate, index) => {

            const item =
                document.createElement("li");

            const button =
                document.createElement("button");

            button.type =
                "button";

            button.className =
                "candidate-button";

            button.textContent =
                candidate.properties?.title ||
                `候補 ${index + 1}`;

            button.addEventListener(
                "click",
                () => selectSearchCandidate(
                    candidate
                )
            );

            item.appendChild(button);

            candidateList.appendChild(item);
        }
    );

    candidateArea.classList.add(
        "visible"
    );
}


function selectSearchCandidate(candidate) {

    // 国土地理院は
    // [経度, 緯度] の順に返す
    const longitude =
        Number(
            candidate.geometry.coordinates[0]
        );

    const latitude =
        Number(
            candidate.geometry.coordinates[1]
        );

    setTemporaryPosition(
        latitude,
        longitude,
        "gsi"
    );

    map.setView(
        [latitude, longitude],
        18
    );

    setSearchMessage(
        "候補位置を表示しました。実際の新聞受け位置へ仮ピンを移動してから登録してください。",
        "success"
    );

    candidateArea.classList.remove(
        "visible"
    );
}


// ========================================
// 手動位置指定・仮ピン
// ========================================

manualPositionBtn.addEventListener(
    "click",
    () => {

        let latitude;
        let longitude;

        if (
            currentMarker
        ) {

            const currentPosition =
                currentMarker.getLatLng();

            latitude =
                currentPosition.lat;

            longitude =
                currentPosition.lng;

        } else {

            const mapCenter =
                map.getCenter();

            latitude =
                mapCenter.lat;

            longitude =
                mapCenter.lng;
        }

        setTemporaryPosition(
            latitude,
            longitude,
            "manual"
        );

        map.setView(
            [latitude, longitude],
            18
        );

        setSearchMessage(
            "仮ピンを表示しました。地図タップまたはドラッグで配達地点を指定してください。",
            "success"
        );
    }
);


function setTemporaryPosition(
    latitude,
    longitude,
    source
) {

    selectedLat =
        Number(latitude);

    selectedLng =
        Number(longitude);

    selectedPositionSource =
        source;

    if (
        temporaryMarker
    ) {

        temporaryMarker.setLatLng(
            [selectedLat, selectedLng]
        );

    } else {

        temporaryMarker =
            L.marker(
                [selectedLat, selectedLng],
                {
                    draggable: true
                }
            )
            .addTo(map)
            .bindPopup(
                "登録予定位置<br>ドラッグして補正できます"
            );

        temporaryMarker.on(
            "dragend",
            () => {

                const position =
                    temporaryMarker.getLatLng();

                selectedLat =
                    position.lat;

                selectedLng =
                    position.lng;

                selectedPositionSource =
                    "manual-correction";

                updateSelectedPositionDisplay();

                setSearchMessage(
                    "仮ピンの位置を補正しました。",
                    "success"
                );
            }
        );
    }

    temporaryMarker.openPopup();

    updateSelectedPositionDisplay();
}


function updateSelectedPositionDisplay() {

    const hasPosition =
        Number.isFinite(selectedLat) &&
        Number.isFinite(selectedLng);

    if (!hasPosition) {

        selectedLatText.textContent =
            "緯度：未選択";

        selectedLngText.textContent =
            "経度：未選択";

        registerHouseBtn.disabled =
            true;

        return;
    }

    selectedLatText.textContent =
        `緯度：${selectedLat.toFixed(7)}`;

    selectedLngText.textContent =
        `経度：${selectedLng.toFixed(7)}`;

    registerHouseBtn.disabled =
        false;
}


// ========================================
// 配達先登録確定
// ========================================

registerHouseBtn.addEventListener(
    "click",
    registerHouse
);


function registerHouse() {

    const name =
        houseNameInput.value.trim();

    const address =
        houseAddressInput.value.trim();

    if (!name) {

        setSearchMessage(
            "配達先名を入力してください。",
            "error"
        );

        houseNameInput.focus();

        return;
    }

    if (
        !Number.isFinite(selectedLat) ||
        !Number.isFinite(selectedLng)
    ) {

        setSearchMessage(
            "住所候補を選ぶか、地図から位置を指定してください。",
            "error"
        );

        return;
    }

    const house = {

        id:
            createHouseId(),

        name,

        address,

        lat:
            selectedLat,

        lng:
            selectedLng,

        positionSource:
            selectedPositionSource ||
            "manual",

        createdAt:
            new Date().toISOString(),

        delivered:
            false
    };

    houses.push(house);

    saveHouses();
    updateHouseList();
    drawHouses();

    showHouseOnMap(house.id);

    resetRegistrationForm();

    setSearchMessage(
        `「${name}」を登録しました。`,
        "success"
    );

    navigator.vibrate?.(
        [120]
    );
}


function createHouseId() {

    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {

        return crypto.randomUUID();
    }

    return (
        Date.now().toString() +
        "-" +
        Math.random()
            .toString(16)
            .slice(2)
    );
}


function resetRegistrationForm() {

    houseNameInput.value = "";
    houseAddressInput.value = "";

    searchCandidates = [];

    candidateList.innerHTML = "";

    candidateArea.classList.remove(
        "visible"
    );

    selectedLat = null;
    selectedLng = null;

    selectedPositionSource = null;

    if (
        temporaryMarker
    ) {

        map.removeLayer(
            temporaryMarker
        );

        temporaryMarker = null;
    }

    updateSelectedPositionDisplay();
}


// ========================================
// 配達開始・終了・履歴消去
// ========================================

startBtn.addEventListener(
    "click",
    () => {

        tracking = true;

        stopTime = 0;
        currentlyStopped = false;

        lastLat = null;
        lastLng = null;
        lastUpdateTime = null;

        recordStatus.textContent =
            "🟢 記録中";

        recordStatus.classList.remove(
            "stopped"
        );

        recordStatus.classList.add(
            "recording"
        );

        document.getElementById(
            "status"
        ).textContent =
            "状態：記録開始";

        navigator.vibrate?.(
            [100]
        );
    }
);


stopBtn.addEventListener(
    "click",
    () => {

        tracking = false;

        stopTime = 0;
        currentlyStopped = false;

        recordStatus.textContent =
            "🔴 記録停止中";

        recordStatus.classList.remove(
            "recording"
        );

        recordStatus.classList.add(
            "stopped"
        );

        document.getElementById(
            "status"
        ).textContent =
            "状態：記録停止";

        document.getElementById(
            "stopTime"
        ).textContent =
            "停止時間：0.0秒";

        navigator.vibrate?.(
            [200]
        );
    }
);


clearBtn.addEventListener(
    "click",
    () => {

        const shouldClear =
            confirm(
                "青いルートと赤い停止地点を消去しますか？\n登録済み配達先は削除されません。"
            );

        if (!shouldClear) {
            return;
        }

        routePoints = [];

        if (
            routeLine
        ) {

            map.removeLayer(
                routeLine
            );

            routeLine = null;
        }

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

        lastLat = null;
        lastLng = null;
        lastUpdateTime = null;

        document.getElementById(
            "distance"
        ).textContent =
            "移動距離：-";

        document.getElementById(
            "stopTime"
        ).textContent =
            "停止時間：0.0秒";

        document.getElementById(
            "stopCount"
        ).textContent =
            "停止地点数：0";

        document.getElementById(
            "debug"
        ).textContent =
            "判定：履歴消去済み";

        navigator.vibrate?.(
            [100, 50, 100]
        );
    }
);


// ========================================
// GPS取得
// ========================================

function startLocationWatch() {

    if (
        !navigator.geolocation
    ) {

        document.getElementById(
            "status"
        ).textContent =
            "状態：この端末は位置情報に対応していません";

        return;
    }

    navigator.geolocation.watchPosition(
        handleLocationUpdate,
        handleLocationError,
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
        }
    );
}


function handleLocationUpdate(position) {

    const latitude =
        position.coords.latitude;

    const longitude =
        position.coords.longitude;

    const accuracy =
        position.coords.accuracy;

    const now =
        Date.now();

    updateCount++;

    updateCurrentLocationMarker(
        latitude,
        longitude,
        accuracy
    );

    updateGpsDisplay(
        latitude,
        longitude,
        accuracy
    );

    if (
        !hasCenteredOnCurrentLocation
    ) {

        map.setView(
            [latitude, longitude],
            18
        );

        hasCenteredOnCurrentLocation =
            true;
    }

    if (tracking) {

        addRoutePoint(
            latitude,
            longitude
        );

        updateStopDetection(
            latitude,
            longitude,
            accuracy,
            now
        );
    }

    lastLat =
        latitude;

    lastLng =
        longitude;

    lastUpdateTime =
        now;
}


function updateCurrentLocationMarker(
    latitude,
    longitude,
    accuracy
) {

    if (
        currentMarker
    ) {

        currentMarker.setLatLng(
            [latitude, longitude]
        );

    } else {

        currentMarker =
            L.circleMarker(
                [latitude, longitude],
                {
                    radius: 8,
                    color: "#005fcc",
                    weight: 3,
                    fillColor: "#2f80ed",
                    fillOpacity: 1
                }
            )
            .addTo(map)
            .bindPopup("現在位置");
    }

    if (
        accuracyCircle
    ) {

        accuracyCircle.setLatLng(
            [latitude, longitude]
        );

        accuracyCircle.setRadius(
            accuracy
        );

    } else {

        accuracyCircle =
            L.circle(
                [latitude, longitude],
                {
                    radius:
                        accuracy,

                    color:
                        "#2f80ed",

                    weight:
                        1,

                    fillColor:
                        "#2f80ed",

                    fillOpacity:
                        0.12
                }
            )
            .addTo(map);
    }
}


function updateGpsDisplay(
    latitude,
    longitude,
    accuracy
) {

    document.getElementById(
        "lat"
    ).textContent =
        `緯度：${latitude}`;

    document.getElementById(
        "lng"
    ).textContent =
        `経度：${longitude}`;

    document.getElementById(
        "accuracy"
    ).textContent =
        `精度：${accuracy.toFixed(1)}m`;

    document.getElementById(
        "count"
    ).textContent =
        `更新回数：${updateCount}`;

    document.getElementById(
        "time"
    ).textContent =
        "更新時刻：" +
        new Date()
            .toLocaleTimeString(
                "ja-JP"
            );
}


function handleLocationError(error) {

    console.error(
        "位置情報エラー",
        error
    );

    let message =
        error.message;

    if (
        error.code === 1
    ) {

        message =
            "位置情報の使用が許可されていません";

    } else if (
        error.code === 2
    ) {

        message =
            "現在位置を取得できません";

    } else if (
        error.code === 3
    ) {

        message =
            "位置情報の取得がタイムアウトしました";
    }

    document.getElementById(
        "status"
    ).textContent =
        `状態：${message}`;
}


// ========================================
// 青いルート
// ========================================

function addRoutePoint(
    latitude,
    longitude
) {

    routePoints.push(
        [latitude, longitude]
    );

    if (
        routeLine
    ) {

        routeLine.setLatLngs(
            routePoints
        );

    } else {

        routeLine =
            L.polyline(
                routePoints,
                {
                    color: "#0066ff",
                    weight: 5,
                    opacity: 0.85
                }
            )
            .addTo(map);
    }
}


// ========================================
// 停止判定
// ========================================

function updateStopDetection(
    latitude,
    longitude,
    accuracy,
    now
) {

    if (
        lastLat === null ||
        lastLng === null ||
        lastUpdateTime === null
    ) {

        return;
    }

    const distance =
        getDistanceMeters(
            lastLat,
            lastLng,
            latitude,
            longitude
        );

    const elapsedSeconds =
        Math.max(
            0,
            (now - lastUpdateTime) / 1000
        );

    const stopThreshold =
        Math.min(
            Math.max(
                MIN_STOP_THRESHOLD_METERS,
                accuracy
            ),
            MAX_STOP_THRESHOLD_METERS
        );

    document.getElementById(
        "distance"
    ).textContent =
        `移動距離：${distance.toFixed(2)}m`;

    document.getElementById(
        "debug"
    ).textContent =
        `判定：距離 ${distance.toFixed(2)}m / 閾値 ${stopThreshold.toFixed(2)}m`;

    if (
        distance <= stopThreshold
    ) {

        stopTime +=
            elapsedSeconds;

        document.getElementById(
            "stopTime"
        ).textContent =
            `停止時間：${stopTime.toFixed(1)}秒`;

        if (
            stopTime >= STOP_SECONDS
        ) {

            document.getElementById(
                "status"
            ).textContent =
                "状態：停止中";

            if (
                !currentlyStopped
            ) {

                currentlyStopped =
                    true;

                addStopMarker(
                    latitude,
                    longitude
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
            "停止時間：0.0秒";

        document.getElementById(
            "status"
        ).textContent =
            "状態：移動中";
    }
}


function addStopMarker(
    latitude,
    longitude
) {

    const stoppedAt =
        new Date();

    const marker =
        L.circleMarker(
            [latitude, longitude],
            {
                radius: 9,
                color: "#a40000",
                weight: 2,
                fillColor: "#ff2222",
                fillOpacity: 0.85
            }
        )
        .addTo(map)
        .bindPopup(
            "停止地点<br>" +
            stoppedAt.toLocaleTimeString(
                "ja-JP"
            )
        );

    stopMarkers.push(marker);

    document.getElementById(
        "stopCount"
    ).textContent =
        `停止地点数：${stopMarkers.length}`;

    navigator.vibrate?.(
        [300]
    );
}


// ========================================
// 2地点間距離
// ========================================

function getDistanceMeters(
    lat1,
    lng1,
    lat2,
    lng2
) {

    const earthRadius =
        6371000;

    const latDifference =
        degreesToRadians(
            lat2 - lat1
        );

    const lngDifference =
        degreesToRadians(
            lng2 - lng1
        );

    const firstLatitude =
        degreesToRadians(lat1);

    const secondLatitude =
        degreesToRadians(lat2);

    const a =
        Math.sin(
            latDifference / 2
        ) ** 2
        +
        Math.cos(firstLatitude)
        *
        Math.cos(secondLatitude)
        *
        Math.sin(
            lngDifference / 2
        ) ** 2;

    const c =
        2
        *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return earthRadius * c;
}


function degreesToRadians(
    degrees
) {

    return degrees *
        Math.PI /
        180;
}


// ========================================
// 共通処理
// ========================================

function setSearchMessage(
    message,
    type
) {

    searchStatus.textContent =
        message;

    searchStatus.classList.remove(
        "success",
        "error"
    );

    if (
        type === "success" ||
        type === "error"
    ) {

        searchStatus.classList.add(
            type
        );
    }
}


function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
