(function(doc, undefined){

    var mapAllUrls = {}, arrAllUrls = [];

    scanUrl();

    arrAllUrls = Object.keys(mapAllUrls);

    if(arrAllUrls.length > 0){
        chrome.extension.sendRequest({
            "action": "initWatch",
            "data": arrAllUrls
        });
    }

	//获得绝对路径
	function getAbs(url){
        var localPath = location;
		if(url && !url.match(/^((https?|file):\/\/|\/)/i))return localPath.protocol+'//'+localPath.host+localPath.pathname.replace(/\\/g,'/').replace(/[^\/]+$/i,'')+url;
		else return url;
	}
    function scanUrl(){
        var arrDoms,dom,i,url;
        var reUrl = /^(https?|file):\/\//,
        //添加当前页
        url = getAbs(location.href);
        if(reUrl.test(url) === true){
            mapAllUrls[url] = {
                type : 'html'
            };
        }
        //遍历所有CSS
        arrDoms = doc.getElementsByTagName('link');
        for(var i = 0, c = arrDoms.length;i < c; i++){
            dom = arrDoms[i];
            if((dom.type && /text\/css/i.test(dom.type)) ||
                (dom.rel && /stylesheet/i.test(dom.rel))){
                url = getAbs(dom.href);
                
                if(reUrl.test(url) === true){
                    mapAllUrls[url] = {
                        type : 'css',
                        dom: dom
                    };
                }
            }
        }
        //遍历所有JS
        arrDoms = doc.getElementsByTagName('script');
        for(var i = 0, c = arrDoms.length;i < c; i++){
            dom = arrDoms[i];
            url = getAbs(dom.src);
            if(url){
                if(reUrl.test(url) === true){
                    mapAllUrls[url] = {
                        type : 'js',
                        dom: dom
                    };
                }
            }
        }
    }

    //重新加载资源
    function reloadTarget(url){
        var checkInfo = mapAllUrls[url];
        if(checkInfo !== undefined){
            if(checkInfo.type === 'css'){
                checkInfo.dom.href = url + (/\?/.test(url)?'&':'?')+'rnd=' + new Date().getTime();
            }
            else{
                location.reload(true);
            }
        }
    }

    function onExtRequest(request, sender, sendResponse){
        if(request.action === 'urlContentChange'){
            reloadTarget(request.item);
        }
    }

    chrome.extension.onRequest.addListener(onExtRequest);

})(document);