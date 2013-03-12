(function(undefined){

    var fileManager = document.getElementById("fileManager");

    var checkInterval = 300;//请求频率

    var arrXMLHttp = [],//HTTP请求池
        httpLimit = 5,//HTTP请求池大小
        xmlhttp;

    for(var i=0;i<httpLimit;i++){
        xmlhttp = new XMLHttpRequest();
        arrXMLHttp.push({
            xmlhttp: xmlhttp,
            bBusy: false
        });
    }

    var arrUrlList = [];

    function getUrl(url, callback){
        if(/^file:\/\//i.test(url)){
            //本地文件
            callback(url, getFile(url));
        }
        else{
            //远程文件排入队列
            arrUrlList.push({
                url: url,
                callback: callback
            });
        }
        getNext();
    }

    function getNext(){
        if(arrUrlList.length > 0){
            var httpObj;
            for(var i=0;i<httpLimit;i++){
                httpObj = arrXMLHttp[i];
                if(httpObj.bBusy === false){
                    getHttp(httpObj, arrUrlList.shift())
                    return;
                }
            }
        }
    }

    function getHttp(httpObj, getObj){
        httpObj.bBusy = true;
        var xmlhttp = httpObj.xmlhttp,
            url = getObj.url,
            callback = getObj.callback;
        xmlhttp.abort();
        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState === 4) {
                httpObj.bBusy = false;
                if(xmlhttp.status === 200){
                    callback(url, xmlhttp.responseText);
                }
                else{
                    callback(url, false);
                }
            }
        };
        xmlhttp.open("GET", url + (/\?/.test(url)?'&':'?')+'rnd=' + new Date().getTime(), true);
        xmlhttp.send(null);
    }

    function getFile(path){
        path = path.replace(/^file:\/\//i,'');
        path = path.replace(/^\/([a-z]:\/)/i,'$1');
        if(fileManager.exists(path)){
            return fileManager.read(path);
        }
        else{
            return false;
        }
    }

    var mapAllUrls = {},
        mapTabUrls = {},
        mapUrlStatus = {},
        mapTabStatus = {};

    //读取存储的开启状态值
    var savedMapUrlStatus = localStorage.getItem('mapUrlStatus');
    if(savedMapUrlStatus){
        mapUrlStatus = JSON.parse(savedMapUrlStatus);
    }

    //添加监控
    function addWatch(tabId, arrUrls){
        mapTabUrls[tabId] = arrUrls;
        arrUrls.forEach(function(url){
            var urlInfo = mapAllUrls[url];
            if(urlInfo === undefined){
                mapAllUrls[url] = urlInfo = {
                    tabs: {}
                };
            }
            urlInfo.tabs[tabId] = true;
        });
    }

    //清除监控
    function clearWatch(tabId){
        var arrUrls = mapTabUrls[tabId];
        if(arrUrls !== undefined){
            arrUrls.forEach(function(url){
                var urlInfo = mapAllUrls[url];
                if(urlInfo){
                    delete urlInfo.tabs[tabId];
                    if(Object.keys(urlInfo.tabs).length === 0){
                        delete mapAllUrls[url];
                    }
                }
            });
            delete mapTabUrls[tabId];
        }
    }

    //开始监控
    function startWatch(){
        for(var url in mapAllUrls){
            if(url){
                getUrl(url, function(url, content){
                    var urlInfo = mapAllUrls[url];
                    if(urlInfo !== undefined){
                        var oldContent = urlInfo.content;
                        if(oldContent === undefined){
                            urlInfo.content = content;
                        }
                        else if(oldContent !== content){
                            urlInfo.content = content;
                            Object.keys(urlInfo.tabs).forEach(function(tabId){
                                fireChange(tabId, url);
                            });
                        }
                    }
                });
            }
        }
        setTimeout(startWatch, checkInterval);
    }

    //触发变更事件
    function fireChange(tabId, url){
        if(mapTabStatus[tabId] === true){
            try{
                chrome.tabs.sendRequest(parseInt(tabId, 10), {
                    "action": "urlContentChange",
                    "item": url
                });
            }
            catch(e){}
        }
    }

    //注入JS脚本
    function onTabUpdated(tabId, changeInfo, tab){
        var tabStatus = changeInfo.status,
            urlStatus = mapUrlStatus[tab.url];
        if(tabStatus === 'complete'){
            if(urlStatus === true){
                mapTabStatus[tabId] = true;//标记当前TAB为启用状态
                injectScript(tabId);
            }
            else{
                //禁用状态下清除监控
                onTabRemoved(tabId);
            }
        }
        else{
            changeIcon(tabId, urlStatus);
        }
    }
    //tab被关闭时清除监控
    function onTabRemoved(tabId){
        clearWatch(tabId);
        delete mapTabStatus[tabId];
    }
    //初始化监控
    function onExtRequest(request, sender, sendResponse){
        if(request.action && request.action === 'initWatch'){
            addWatch(sender.tab.id, request.data);
        }
    }
    //图标被点击，切换开启或关闭
    function onBrowserActionClicked(tab){
        var tabId = tab.id,
            url = tab.url, 
            urlStatus = mapUrlStatus[url] ? mapUrlStatus[url] : false;
        if(urlStatus === true){
            //关闭
            delete mapUrlStatus[url];
            delete mapTabStatus[tabId];
        }
        else{
            //开启
            if(mapTabUrls[tabId] === undefined){
                injectScript(tabId);
            }
            mapTabStatus[tabId] = mapUrlStatus[url] = true;
        }
        changeIcon(tabId, !urlStatus);
        localStorage.setItem('mapUrlStatus', JSON.stringify(mapUrlStatus));
    }
    //更改状态图标
    function changeIcon(tabId, urlStatus){
        chrome.browserAction.setIcon({
            tabId: tabId,
            path: urlStatus === true ? 'img/icon16.png' :'img/icon16-off.png'
        });
    }
    //注入JS代码
    function injectScript(tabId){
        clearWatch(tabId);
        chrome.tabs.executeScript(tabId, {
            "file": 'js/content.js'
        });
    }
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    chrome.tabs.onRemoved.addListener(onTabRemoved);
    chrome.extension.onRequest.addListener(onExtRequest);
    chrome.browserAction.onClicked.addListener(onBrowserActionClicked);
    startWatch();
})();