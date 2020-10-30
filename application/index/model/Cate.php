<?php  
namespace app\index\model;
/**
* 商品分类前台模型层
*/
class Cate extends \think\Model
{
	public function getChildren($cate_list,$pid=0){
		//得到全部子级，多维数组
		$arr = array();
		foreach ($cate_list as $key => $value) {
			if ($value['pid']==$pid) {
				$value['children'] = $this->getChildren($cate_list,$value['id']);
				$arr[] = $value;
			}
		}
		return $arr;
	}
	
}
?>