<?php
namespace app\index\controller;
use \think\Controller;
class Index extends Controller
{
    public function index()
    {



       //通过分类id获取其下的新闻列表
        $news_fenlei = db('newsfenlei')->select();

        $wenda = db('newsfenlei')->select();



        $array = array();
        $array_wenda = array();




        foreach ($news_fenlei as $key => $value) {
            if($value['pid']==0){
            


                $children = getChildren($news_fenlei,$value['id']);
               // 现在从foreach之前的所有数组中，找到这两条数组中获取id主键的所有儿子类，

                array_unshift($children, $value);
                //将父类添加到子类的前面，组成一个新的数组。现在这两条$value前面是自己，后面是子类；



                $ids = array_column($children, 'id');//额外组成一个id的单列数组ids

                $news = db('news')->where('pid','in',$ids)->select();//获取所有父类是在ids组中的数组


      
                $wenda = db('wenda')->where('pid','in',$ids)->select();


                $array[$key] = $children[0];
                $array[$key]['children'] = $news;

                $array_weda[$key] = $children[0];
                $array_wenda[$key]['children'] = $wenda;



/*$new_detail = db('news')->where('id','in',$news)->select();//获取所有父类是在ids组中的数组*/


            }
        }

      /*  dump($array[0]['children']['2']['content']);*/

$qqq= array();

foreach ($wenda as $keykk => $valuekk) {

$aa = $valuekk['keywords_w'];

$keywordstt = '备孕';


    if(strstr( $aa, $keywordstt) !== false ){
        
        array_push($qqq, $valuekk);

    }

}













        $first_fenlei = $array['1']['children'];

/*$first_fenleictn = strip_tags($first_fenlei['content']);
*/
/*$aa= array();
foreach ($first_fenlei as $key1 => $value1) {
   $each_ctn = $value1['content'];
   $q= array($each_ctn);
   $aa=  array_merge($aa, $q);
};*/

      

        $wenda_fenlei = $array_wenda['6']['children'];

        $wenda_fenlei2 = $qqq;
      /*  $User = model($wenda_fenlei);
*/
/*        $map = [['keywords','like','备孕%'], ['title','like','备孕'],];
        $User->where($map)->select();
            dump($User);*/

/*        $news_title = array_column($first_fenlei, 'title');
         $this->assign('news_title',$news_title);*/

         $this->assign('first_fenlei',$first_fenlei);
         $this->assign('wenda_fenlei',$wenda_fenlei);

        $this->assign('wenda_fenlei2',$wenda_fenlei2);

        $cate_select = db('newsfenlei')->order('id')->select();
        $cate_model = model('cate');
        $cate_list = $cate_model->getChildren($cate_select);

        $this->assign('cate_list',$cate_list);




        $n_tags_select = db('news')->select();


        $tags_select = db('shouyetags')->where('zhiding','=',1)->select();
   
  

        $ztags= array();
      
        foreach ($tags_select as $key_tgg => $value_tgg) {
  
            foreach ($n_tags_select as $ntags_key => $ntags_value) {
                $bb = $ntags_value['keywords'];
                $keywords_tag = $value_tgg['tags_name'];
                //判断找到关键字
                  if(strstr($bb, $keywords_tag) !== false   ){
                         array_push($ztags, $ntags_value);
                    }
            }
    }
     


$z1=$tags_select['0']['tags_name'];

$first_qk =array();

foreach ($ztags as $key1 => $value1) {

$keywords_tag2 = $value1['keywords'];
                //判断找到关键字
                  if(strstr($z1, $keywords_tag2) !== false ){
                         array_push($first_qk, $value1);
                    }
}

dump($first_qk);
       
  $this->assign('tags_select',$tags_select);

    $this->assign('ztags',$ztags);

    $this->assign('first_qk',$first_qk);
        return view();






    }

        function azixun(){
            return view();
        }
           



        function cs(){
  



        }
}
